
import pool from '../lib/db';
import * as gmailClient from '../lib/gmailClient';
import { CreditCardMailDetector } from '../services/creditCardMailDetector';
import { batchQueue, SimplifiedEmail } from '../services/batchQueueService';
import dayjs from 'dayjs';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../utils/logger';

/**
 * Historical Email Scanner (GPT Batch Producer)
 * Fetches emails and enqueues them for GPT processing
 */
export async function runHistoricalScan(
  userId: string,
  jobId: string,
  fromDate?: Date,
  toDate?: Date
) {
  logger.info(`[HistoricalScanner] Starting scan ${jobId} for user:`, userId);

  try {
    // Get user's refresh token
    const { rows: users } = await pool.query(
      'SELECT id, email, google_refresh_token FROM users WHERE id = $1',
      [userId]
    );

    if (users.length === 0) throw new Error('User not found');
    const user = users[0];

    if (!user.google_refresh_token) {
      throw new Error('Gmail not connected. Please connect your Gmail account in Settings > Gmail Integration before syncing.');
    }

    // Build Gmail query
    // Default to last 90 days if not optimizing for incremental
    const fixedStartDate = dayjs().subtract(90, 'day');
    let fromDateToUse = fromDate ? dayjs(fromDate) : fixedStartDate;

    // Optimization: If incremental sync logic existed, we could use it here.
    // For now, relying on safe default.

    const from = fromDateToUse.format('YYYY/MM/DD');
    const to = toDate ? dayjs(toDate).format('YYYY/MM/DD') : dayjs().format('YYYY/MM/DD');

    // Use existing sender filter to minimize cost
    const senderFilter = CreditCardMailDetector.SENDER_DOMAINS
      .map(domain => `from:"${domain}"`)
      .join(' OR ');

    const query = `after:${from} before:${to} (${senderFilter})`;
    logger.debug(`[HistoricalScanner] Query:`, query);

    // Initial job update
    await pool.query(
      `UPDATE gmail_sync_jobs 
       SET status = 'running', current_step = 'FETCHING_AND_ENQUEUING', total_messages = 0, last_update_at = NOW()
       WHERE id = $1`,
      [jobId]
    );

    const FETCH_BATCH_SIZE = 200;
    let pageToken: string | undefined = undefined;
    let totalFetched = 0;
    let limitReached = false;
    let batchIndex = 0;

    // Fetch Loop
    do {
      batchIndex++;
      logger.info(`[HistoricalScanner] Fetching batch ${batchIndex}...`);

      const response = await gmailClient.listMessages(user.google_refresh_token, query, FETCH_BATCH_SIZE, pageToken);
      const messages = response.messages;
      pageToken = response.nextPageToken;

      if (!messages || messages.length === 0) {
        break;
      }

      // Fetch Raw Content
      const messageIds = messages.map(m => m.id);
      // Fetch concurrently but respectful of rate limits (limit handling inside gmailClient ideally, or here)
      // Assuming gmailClient.batchGetMessages handles basic concurrency
      const rawMessages = await gmailClient.batchGetMessages(user.google_refresh_token, messageIds, 50);

      // Transform to SimplifiedEmail
      const emailsForQueue: SimplifiedEmail[] = [];

      for (const raw of rawMessages) {
        if (!raw) continue;

        try {
          const parsed = gmailClient.parseMessage(raw);

          emailsForQueue.push({
            messageId: parsed.id,
            threadId: parsed.threadId,
            from: parsed.from,
            to: parsed.to, // parsedMessage doesn't extract 'To' currently, need to check if critical. 
            // processJobWrapper uses 'to' only for logging or unused? 
            // SimplifiedEmail interface requires 'to'. 
            // Let's add 'to' to parseMessage if needed, or extract it here.
            subject: parsed.subject,
            body: parsed.bodyText || parsed.bodyHtml || parsed.snippet, // Prioritize text
            internalDate: parsed.date.getTime()
          });
        } catch (e) {
          logger.warn(`[HistoricalScanner] Failed to parse message ${raw.id}`, e);
        }
      }

      // Enqueue
      if (emailsForQueue.length > 0) {
        await batchQueue.enqueue(userId, jobId, emailsForQueue);
        totalFetched += emailsForQueue.length;

        // Update Job 'total_messages' to reflect what we have found *so far*
        await pool.query(
          `UPDATE gmail_sync_jobs 
             SET total_messages = $1, last_update_at = NOW()
             WHERE id = $2`,
          [totalFetched, jobId]
        );
      }

    } while (pageToken);

    logger.info(`[HistoricalScanner] Fetching complete. Total enqueued: ${totalFetched}`);

    // NOTE: Job status is NOT set to 'completed' here.
    // It should be set to 'completed' only when Queue is empty.
    // However, the current architecture might assume this function finishing means 'sync done'.
    // We should probably update status to 'PROCESSING' and let the Processor or a Checker mark it complete.
    // For now, we'll leave it in 'running' state, or 'PROCESSING'.

    await pool.query(
      `UPDATE gmail_sync_jobs 
         SET current_step = 'PROCESSING', last_update_at = NOW()
         WHERE id = $1`,
      [jobId]
    );

    return { total: totalFetched };

  } catch (error) {
    logger.error(`[HistoricalScanner] Scan ${jobId} failed:`, error);
    await pool.query(
      `UPDATE gmail_sync_jobs 
       SET status = 'failed', errors = $1, completed_at = NOW(), last_update_at = NOW()
       WHERE id = $2`,
      [JSON.stringify([{ error: error instanceof Error ? error.message : 'Unknown error' }]), jobId]
    );
    throw error;
  }
}

// CLI Support (Legacy)
if (require.main === module) {
  // ... preserved mostly for testing ... 
  const userId = process.argv[2];
  const jobId = process.argv[3] || `manual-${Date.now()}`;
  if (!userId) { logger.error('Usage: <userId>'); process.exit(1); }
  runHistoricalScan(userId, jobId).catch(err => logger.error(err));
}
