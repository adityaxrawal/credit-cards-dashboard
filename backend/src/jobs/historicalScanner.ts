import { decrypt } from '../utils/encryption';
import pool from '../lib/db';
import * as gmailClient from '../lib/gmailClient';
import { GmailFetcherService } from '../services/gmail/fetcher';
import { SanitizerService } from '../services/sanitize/sanitizer';
import { FilterService } from '../services/filters/filterService';
import { RuleProcessor } from '../services/rules/ruleProcessor';
import { TerminatorService } from '../services/terminator/terminator';
import { gptQueue } from '../services/queue/gptQueue';
import { gptProcessor } from '../services/gpt/gptProcessor';
import * as transactionsService from '../services/transactions.service';
import dayjs from 'dayjs';
import logger from '../utils/logger';

/**
 * Historical Email Scanner (Refactored for Architecture V2)
 */
export async function runHistoricalScan(
  userId: string,
  jobId: string,
  fromDate?: Date,
  toDate?: Date
) {
  logger.info(`[HistoricalScanner] Starting NEW ARCHITECTURE scan ${jobId} for user:`, userId);

  try {
    // 1. Validate User & Token
    const { rows: users } = await pool.query(
      'SELECT id, email, google_refresh_token FROM users WHERE id = $1',
      [userId]
    );
    if (users.length === 0) throw new Error('User not found');
    const user = users[0];
    if (!user.google_refresh_token) throw new Error('Gmail not connected');
    const refreshToken = decrypt(user.google_refresh_token);

    // 2. Setup Query
    const fromDateToUse = fromDate ? dayjs(fromDate) : dayjs().subtract(90, 'day');
    const from = fromDateToUse.format('YYYY/MM/DD');
    const to = toDate ? dayjs(toDate).format('YYYY/MM/DD') : dayjs().format('YYYY/MM/DD');
    const senderFilter = FilterService['SENDER_DOMAINS'].map(d => `from:"${d}"`).join(' OR ');
    const query = `after:${from} before:${to} (${senderFilter})`;

    await pool.query(
      `UPDATE gmail_sync_jobs 
       SET status = 'running', current_step = 'FETCHING_AND_PROCESSING', total_messages = 0, last_update_at = NOW()
       WHERE id = $1`,
      [jobId]
    );

    const FETCH_BATCH_SIZE = 200;
    const PARALLEL_LIMIT = 20;
    let pageToken: string | undefined = undefined;
    let totalFetched = 0;
    let stats = { success: 0, failed: 0, queuedGpt: 0, terminated: 0 };

    // 3. Main Loop
    do {
      logger.info(`[HistoricalScanner] Fetching batch...`);
      const { messages, nextPageToken } = await GmailFetcherService.fetchBatch(refreshToken, query, FETCH_BATCH_SIZE, pageToken);
      pageToken = nextPageToken;

      if (messages.length === 0) continue;
      totalFetched += messages.length;

      // Split into chunks of 20 for Parallel Processing
      for (let i = 0; i < messages.length; i += PARALLEL_LIMIT) {
        const chunk = messages.slice(i, i + PARALLEL_LIMIT);

        await Promise.all(chunk.map(async (rawEmail) => {
          try {
            const fetchAttachment = async (msgId: string, attId: string) => {
              return gmailClient.getAttachment(refreshToken, msgId, attId);
            };

            const cleanEmail = await SanitizerService.sanitize(rawEmail, fetchAttachment);
            const filterResult = FilterService.filter(cleanEmail);

            if (!filterResult.shouldProcess) {
              stats.terminated++;
              await TerminatorService.terminate(userId, cleanEmail.id, filterResult.reason, 'filter');
              return;
            }

            const ruleResult = await RuleProcessor.process(cleanEmail);

            if (ruleResult.status === 'passed' && ruleResult.transaction) {
              try {
                await transactionsService.createTransactionFromExtraction(userId, {
                  ...ruleResult.transaction,
                  extractionMethod: 'rule_based',
                  confidence: ruleResult.confidenceScore || 1.0
                }, {
                  id: cleanEmail.id,
                  subject: cleanEmail.subject,
                  body: cleanEmail.cleanedBody,
                  from: cleanEmail.from
                });
                stats.success++;
                await pool.query(
                  `INSERT INTO email_processing_log (user_id, email_message_id, processing_status, reason, created_at)
                               VALUES ($1, $2, 'success', 'Rule-based success', NOW()) ON CONFLICT (email_message_id) DO UPDATE SET processing_status='success'`,
                  [userId, cleanEmail.id]
                );
              } catch (insertErr: any) {
                if (insertErr.code === '23505') { // Duplicate
                  stats.terminated++;
                } else {
                  console.error(`[Scanner] Insert failed:`, insertErr);
                  stats.failed++;
                }
              }
            } else {
              stats.queuedGpt++;
              gptQueue.enqueue({
                ...cleanEmail,
                userId: userId
              });
            }

          } catch (e) {
            console.error(`[Scanner] Error processing email ${rawEmail.messageId}`, e);
            stats.failed++;
          }
        }));
      }

      await pool.query(
        `UPDATE gmail_sync_jobs 
           SET total_messages = $1, rule_based_success = $2, rule_based_failure = $3, queued_for_gpt = $4, terminated_count = $5, last_update_at = NOW()
           WHERE id = $6`,
        [totalFetched, stats.success, stats.failed, stats.queuedGpt, stats.terminated, jobId]
      );

    } while (pageToken);

    logger.info(`[HistoricalScanner] Fetching complete. Flushing GPT queue...`);

    (gptQueue as any).flush();

    let retries = 0;
    while ((gptQueue.length > 0) && retries < 60) {
      await new Promise(r => setTimeout(r, 1000));
      retries++;
    }

    await pool.query(
      `UPDATE gmail_sync_jobs SET status = 'completed', current_step = 'COMPLETED', progress = 100, last_update_at = NOW() WHERE id = $1`,
      [jobId]
    );

    return { total: totalFetched };

  } catch (error) {
    logger.error(`[HistoricalScanner] Failed:`, error);
    await pool.query(
      `UPDATE gmail_sync_jobs SET status = 'failed', errors = $1 WHERE id = $2`,
      [JSON.stringify([{ error: error instanceof Error ? error.message : 'Unknown' }]), jobId]
    );
    throw error;
  }
}

// CLI Support
if (require.main === module) {
  const userId = process.argv[2];
  const jobId = process.argv[3] || `manual-${Date.now()}`;
  if (!userId) { logger.error('Usage: <userId>'); process.exit(1); }
  runHistoricalScan(userId, jobId).catch(err => logger.error(err));
}
