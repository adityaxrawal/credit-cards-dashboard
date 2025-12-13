
import pool from '../lib/db';
import * as gmailClient from '../lib/gmailClient';
import { CreditCardMailDetector } from '../services/creditCardMailDetector';
import { batchQueue, SimplifiedEmail } from '../services/batchQueueService'; // Keeping types if needed, but not using this queue anymore directly ideally?
// Actually we should use the new coordinator. 
import { parallelProcessingCoordinator } from '../services/parallelProcessingCoordinator';
import { gptQueueManager } from '../services/gptQueueManager';
import dayjs from 'dayjs';
import logger from '../utils/logger';
import { EmailProcessingLogService } from '../services/emailProcessingLog.service';
import * as extractionService from '../services/extraction.service';

/**
 * Historical Email Scanner (Parallel Version)
 */
export async function runHistoricalScan(
  userId: string,
  jobId: string,
  fromDate?: Date,
  toDate?: Date
) {
  logger.info(`[HistoricalScanner] Starting PARALLEL scan ${jobId} for user:`, userId);

  try {
    // ... (User check and Gmail token check same as before) ...
    const { rows: users } = await pool.query(
      'SELECT id, email, google_refresh_token FROM users WHERE id = $1',
      [userId]
    );
    if (users.length === 0) throw new Error('User not found');
    const user = users[0];
    if (!user.google_refresh_token) throw new Error('Gmail not connected');

    // ... (Date range and Query building same as before) ...
    const fixedStartDate = dayjs().subtract(90, 'day');
    const fromDateToUse = fromDate ? dayjs(fromDate) : fixedStartDate;
    const from = fromDateToUse.format('YYYY/MM/DD');
    const to = toDate ? dayjs(toDate).format('YYYY/MM/DD') : dayjs().format('YYYY/MM/DD');
    const senderFilter = CreditCardMailDetector.SENDER_DOMAINS.map(d => `from:"${d}"`).join(' OR ');
    const query = `after:${from} before:${to} (${senderFilter})`;

    await pool.query(
      `UPDATE gmail_sync_jobs 
       SET status = 'running', current_step = 'FETCHING_AND_PROCESSING', total_messages = 0, last_update_at = NOW()
       WHERE id = $1`,
      [jobId]
    );

    const FETCH_BATCH_SIZE = 50;
    let pageToken: string | undefined = undefined;
    let totalFetched = 0;
    let ruleBasedSuccessCount = 0;
    let ruleBasedFailureCount = 0; // effectively queued for GPT
    let terminatorCount = 0;
    let queuedForGptCount = 0;
    let batchIndex = 0;

    // Fetch Loop
    do {
      batchIndex++;
      logger.info(`[HistoricalScanner] Fetching batch ${batchIndex}...`);

      const response = await gmailClient.listMessages(user.google_refresh_token, query, FETCH_BATCH_SIZE, pageToken);
      const messages = response.messages;
      pageToken = response.nextPageToken;


      // Fetch Content
      const messageIds = messages.map(m => m.id);
      const rawMessages = await gmailClient.batchGetMessages(user.google_refresh_token, messageIds, 50);

      // Prepare for Coordinator
      const emailsToProcess: extractionService.ExtractionInput[] = [];

      for (const raw of rawMessages) {
        if (!raw) continue;
        try {
          const parsedEmail = gmailClient.parseMessage(raw);
          const simplifiedEmail = {
            messageId: parsedEmail.id,
            threadId: parsedEmail.threadId,
            from: parsedEmail.from,
            to: parsedEmail.to,
            subject: parsedEmail.subject,
            body: parsedEmail.bodyText || parsedEmail.bodyHtml || parsedEmail.snippet,
            internalDate: parsedEmail.date.getTime()
          };

          // Log scanned (same as before)
          try {
            await pool.query(
              `INSERT INTO gmail_scanned_emails 
                (user_id, scan_job_id, message_id, sender, subject, snippet, internal_date, scanned_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT (message_id) DO NOTHING`,
              [userId, jobId, simplifiedEmail.messageId, simplifiedEmail.from.substring(0, 500), simplifiedEmail.subject.substring(0, 1000), simplifiedEmail.body.substring(0, 500), simplifiedEmail.internalDate]
            );
          } catch (e) { }

          // Convert to ExtractionInput
          emailsToProcess.push({
            id: parsedEmail.id,
            subject: parsedEmail.subject,
            from: parsedEmail.from,
            bodyText: parsedEmail.bodyText || '',
            bodyHtml: parsedEmail.bodyHtml,
            date: parsedEmail.date,
            threadId: parsedEmail.threadId,
            attachments: parsedEmail.attachments?.map(a => ({ ...a, id: a.id || '', filename: a.filename || '', mimeType: a.mimeType || '' }))
          });

        } catch (e) {
          logger.warn(`Failed to parse/prep message ${raw.id}`, e);
        }
      }

      // PARALLEL PROCESSING
      if (emailsToProcess.length > 0) {
        logger.info(`[HistoricalScanner] Sending ${emailsToProcess.length} emails to Parallel Coordinator...`);
        const stats = await parallelProcessingCoordinator.processEmails(emailsToProcess, userId, jobId);

        // Update stats
        totalFetched += emailsToProcess.length;
        ruleBasedSuccessCount += stats.success;
        terminatorCount += stats.ignored; // Ignored = not processed/skipped
        queuedForGptCount += stats.queued;
        ruleBasedFailureCount += stats.queued;

        // Update Job using calculated stats
        await pool.query(
          `UPDATE gmail_sync_jobs 
               SET total_messages = $1, 
                   rule_based_success = $2,
                   rule_based_failure = $3,
                   queued_for_gpt = $4,
                   terminated_count = $5,
                   last_update_at = NOW()
               WHERE id = $6`,
          [totalFetched, ruleBasedSuccessCount, ruleBasedFailureCount, queuedForGptCount, terminatorCount, jobId]
        );
      }

    } while (pageToken);

    logger.info(`[HistoricalScanner] Fetching complete. Waiting for GPT queues...`);

    // NOTE: In the new architecture, GPT processing is asynchronous via events.
    // If the scanner script exits, the GPT processor (if running in same process) might die.
    // We should probably wait until queues are drained if we are running as a script.

    // Check queues
    let queueStats = gptQueueManager.getQueueStats();
    let retries = 0;
    while ((queueStats.queue1 > 0 || queueStats.queue2 > 0 || queueStats.queue3 > 0) && retries < 30) {
      logger.info(`[HistoricalScanner] Waiting for queues to drain:`, queueStats);
      await new Promise(r => setTimeout(r, 2000));
      queueStats = gptQueueManager.getQueueStats();
      retries++;
    }

    // Also wait for active batches? gptProcessor doesn't expose active count easily unless we add getter.
    // Ideally the main process keeps running.

    // Update to PROCESSING state (for UI)
    await pool.query(
      `UPDATE gmail_sync_jobs 
         SET current_step = 'PROCESSING', last_update_at = NOW()
         WHERE id = $1`,
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
