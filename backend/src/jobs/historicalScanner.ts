import { decrypt } from '../utils/helpers/encryption';
import pool from '../lib/db';
import * as gmailClient from '../lib/gmailClient';
import { GmailFetcherService } from '../services/gmail/fetcher';
import logger from '../utils/infrastructure/logger';
import { WorkflowLogger } from '../utils/infrastructure/workflowLogger';
import { universalPipeline } from '../services/transactions/pipeline/UniversalTransactionPipeline';
import { SimplifiedEmail } from '../types/transaction.types'; // Use new types
import dayjs from 'dayjs';

/**
 * Historical Email Scanner (Optimized for 200/sec Throughput)
 * Uses Producer-Consumer pattern:
 * - Producer: Fetches from Gmail aggressively.
 * - Consumer: Processes emails (Sanitize -> Filter -> Rule -> DB).
 */
export async function runHistoricalScan(
  userId: string,
  jobId: string,
  fromDate?: Date,
  toDate?: Date
) {
  logger.info(`[HistoricalScanner] Starting FAST scan ${jobId} for user:`, userId);
  WorkflowLogger.log('FETCH', `Starting historical scan (Fast Mode)`, { jobId, userId });

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
    // Fetch ALL emails to ensure we never miss a transaction.
    const query = `after:${from} before:${to} in:inbox`;

    // Initialize job status
    await pool.query(
      `UPDATE gmail_sync_jobs 
       SET status = 'PROCESSING', 
           current_step = 'FETCHING', 
           total_messages = 0, 
           emails_fetched = 0,
           progress = 0,
           last_update_at = NOW(),
           date_range_start = $2,
           date_range_end = $3
       WHERE id = $1`,
      [jobId, fromDateToUse.toDate(), toDate ? new Date(toDate) : new Date()]
    );

    // --- SHARED STATE ---
    // In-memory queue between Producer (Fetch) and Consumer (Process)
    const processingQueue: SimplifiedEmail[] = [];
    let isFetching = true;
    let totalFetched = 0;

    // Stats
    const stats = { success: 0, failed: 0, needs_review: 0, terminated: 0, duplicate: 0 };
    // Error Collection
    const jobErrors: string[] = [];

    // Config
    const FETCH_BATCH_SIZE = 50;  // Reduced for stability
    const HIGH_WATER_MARK = 200;  // Buffer more items before pausing
    const LOW_WATER_MARK = 50;   // Resume sooner

    // --- PRODUCER LOOP (FETCH) ---
    const fetchLoop = async () => {
      let pageToken: string | undefined = undefined;
      console.log(`[PHASE: FETCH] Starting fetch loop with batch size ${FETCH_BATCH_SIZE}`);

      try {
        do {
          // Backpressure check
          if (processingQueue.length > HIGH_WATER_MARK) {
            WorkflowLogger.log('FETCH', `Backpressure: Queue size ${processingQueue.length}. Pausing fetch...`, { jobId });
            while (processingQueue.length > LOW_WATER_MARK) {
              await new Promise(r => setTimeout(r, 200));
            }
            WorkflowLogger.log('FETCH', `Resuming fetch...`, { jobId });
          }

          WorkflowLogger.log('FETCH', `Listing batch...`, { jobId });

          const fetchStart = Date.now();
          const { messages, nextPageToken } = await GmailFetcherService.fetchBatch(refreshToken, userId, query, FETCH_BATCH_SIZE, pageToken);
          pageToken = nextPageToken;
          console.log(`[PHASE: FETCH] Fetched ${messages.length} messages in ${Date.now() - fetchStart}ms`);

          if (messages.length > 0) {
            totalFetched += messages.length;
            processingQueue.push(...messages as any[]);
            WorkflowLogger.log('FETCH', `Pushed ${messages.length} to queue. Total Fetched: ${totalFetched}`, { jobId, queueSize: processingQueue.length });
          }

        } while (pageToken);
        console.log(`[PHASE: FETCH] Fetch loop completed. Total fetched: ${totalFetched}`);

        // OPTIMIZATION: If totalFetched is 0, we can finish early!
        if (totalFetched === 0) {
          logger.info(`[HistoricalScanner] No messages found for job ${jobId}. Completing early.`);
          isFetching = false; // Stop consumer loop (it will do one check then exit)
          // We'll let the processLoop finish naturally (it will see empty queue and isFetching=false)
          // But we need to ensure updateJobStats doesn't get confused.
        }

      } catch (err) {
        logger.error('[HistoricalScanner] Fetch loop error:', err);
        throw err;
      } finally {
        isFetching = false; // Signal consumer we are done
      }
    };

    // --- CONSUMER LOOP (PROCESS) ---
    const processLoop = async () => {
      logger.info(`[PROCESS] Starting consumer loop for job ${jobId}`);
      console.log(`\nStarting Parallel Process Loop (Concurrency: 10)`);

      let consecutiveErrors = 0;
      const MAX_CONSECUTIVE_ERRORS = 50;

      while (isFetching || processingQueue.length > 0) {
        // Circuit Breaker
        if (consecutiveErrors > MAX_CONSECUTIVE_ERRORS) {
          logger.error(`[PROCESS] Circuit breaker tripped! Over ${MAX_CONSECUTIVE_ERRORS} consecutive errors. Aborting job.`);
          isFetching = false; // Stop producer
          processingQueue.length = 0; // Clear queue
          break;
        }

        if (processingQueue.length === 0) {
          // Wait briefly for producer
          await new Promise(r => setTimeout(r, 50));
          continue;
        }

        // Take a chunk off the queue
        const batchSize = 10;
        const batch = processingQueue.splice(0, batchSize);
        const batchStartTime = Date.now();

        console.log(`\n[PHASE: PROCESS] Processing batch of ${batch.length} emails. Queue rem: ${processingQueue.length}`);

        // Process this batch in parallel
        await Promise.all(batch.map(async (email) => {
          try {
            await processSingleEmail(email);
            consecutiveErrors = 0; // Reset on success
          } catch (e) {
            console.error(`Error processing email ${email.messageId}`, e);
            stats.failed++;
            consecutiveErrors++;
          }
        }));

        const batchDuration = Date.now() - batchStartTime;
        console.log(`[PHASE: PROCESS] Processed ${batch.length} emails in ${batchDuration}ms (${Math.round(batch.length / (batchDuration / 1000))} emails/sec)`);

        // Update DB periodically (approx every batch)
        await updateJobStats(jobId, totalFetched, stats);
      }
      logger.info(`[PROCESS] Consumer loop finished. Queue empty and fetch complete.`);
    };

    // --- PROCESS SINGLE EMAIL ---
    const processSingleEmail = async (cleanEmail: SimplifiedEmail) => {
      const fetchAttachment = async (msgId: string, attId: string) => {
        return gmailClient.getAttachment(refreshToken, msgId, attId);
      };

      // Delegate to Universal Pipeline
      const result = await universalPipeline.processEmail(userId, cleanEmail, jobId, fetchAttachment);

      // Update Stats based on result
      if (result.status === 'success') stats.success++;
      else if (result.status === 'terminated') stats.terminated++;
      else if (result.status === 'duplicate') stats.duplicate++;
      else if (result.status === 'needs_review') stats.needs_review++;
      else if (result.status === 'failed') {
        stats.failed++;
        // Capture error
        if (result.error && jobErrors.length < 20) {
          const errMsg = `[${cleanEmail.messageId}] ${result.error}`;
          if (!jobErrors.includes(errMsg)) {
            jobErrors.push(errMsg);
          }
        }
      }
    };

    const updateJobStats = async (jid: string, total: number, curStats: any) => {
      // Logic for total processed
      // Map old columns to new metrics roughly
      // rule_based_success -> success (approx)
      // terminated_count -> terminated
      // queued_for_gpt -> 0 (handled mostly internally, or map needs_review here?)
      // Let's map 'needs_review' to a field or just count it as success but flagged

      const processed = curStats.success + curStats.failed + curStats.terminated + curStats.duplicate + curStats.needs_review;
      const progress = total > 0 ? Math.floor((processed / total) * 100) : 0;

      // Persist partial errors if any
      const errorsJson = jobErrors.length > 0 ? JSON.stringify(jobErrors) : '[]';

      await pool.query(
        `UPDATE gmail_sync_jobs 
             SET total_messages = $1, 
                 emails_fetched = $1,
                 processed_count = $2,
                 progress = $3,
                 rule_based_success = $4, 
                 rule_based_failure = $5, -- Map failed here
                 queued_for_gpt = $6, -- Map needs_review here for visibility? Or just use metadata
                 terminated_count = $7, 
                 errors = $8::jsonb,
                 last_update_at = NOW()
             WHERE id = $9`,
        [total, processed, progress, curStats.success, curStats.failed, curStats.needs_review, curStats.terminated, errorsJson, jid]
      );
    };


    // --- LAUNCH PARALLEL LOOPS ---
    WorkflowLogger.log('FETCH', `Launching parallel Fetch and Process loops`, { jobId });
    const start = Date.now();

    await Promise.all([
      fetchLoop(),
      processLoop()
    ]);

    const duration = (Date.now() - start) / 1000;
    const fetchRate = Math.round(totalFetched / duration);
    const processRate = Math.round((stats.success + stats.failed + stats.terminated + stats.needs_review) / duration);

    // Log completion metrics at INFO level representing new pipeline stats
    logger.info(`[HistoricalScanner] Scan ${jobId} completed`, {
      duration: `${duration.toFixed(1)}s`,
      totalFetched,
      fetchRate: `${fetchRate}/sec`,
      processRate: `${processRate}/sec`,
      stats
    });
    WorkflowLogger.log('COMPLETED', `Scan finished in ${duration}s. Rate: ${fetchRate}/sec`, { jobId, stats });


    // --- CLEANUP ---
    // Universal pipeline doesn't have an external queue to flush unless GPTClassifier batching is hanging?
    // GPTClassifier handles flushing on timeout or size. By end of loop, pending batch might exist.
    // Ideally we should call a flush on GPTClassifier if needed, but it self-manages mostly.
    // If strict, we could add a shutdown method to GPTClassifier.
    // For now, allow processLoop to finish which implies all promises resolved.

    await pool.query(
      `UPDATE gmail_sync_jobs SET status = 'COMPLETED', current_step = 'COMPLETED', progress = 100, emails_processed = total_messages, last_update_at = NOW(), completed_at = NOW() WHERE id = $1`,
      [jobId]
    );

    // Emit Final WebSocket Update
    const { broadcastJobComplete } = await import('../services/alerts/WebSocketService');
    broadcastJobComplete(jobId, {
      totalEmails: totalFetched,
      totalTransactions: stats.success,
      processed: totalFetched,
      status: 'COMPLETED'
    });

    return { total: totalFetched };

  } catch (error) {
    WorkflowLogger.error('FAILED', `Scan failed`, error, { jobId });
    await pool.query(
      `UPDATE gmail_sync_jobs SET status = 'FAILED', errors = $1, completed_at = NOW() WHERE id = $2`,
      [JSON.stringify([{ error: error instanceof Error ? error.message : 'Unknown' }]), jobId]
    );
    throw error;
  } finally {
    // SAFETY NET: Ensure job is never left hanging
    try {
      const { rows } = await pool.query('SELECT status FROM gmail_sync_jobs WHERE id = $1', [jobId]);
      if (rows.length > 0) {
        const status = rows[0].status;
        const activeStatuses = ['PENDING', 'PROCESSING', 'FETCHING', 'GPT_PROCESSING'];

        if (activeStatuses.includes(status)) {
          logger.warn(`[HistoricalScanner] Safety Net: Job ${jobId} ended in ${status} state. Forcing COMPLETED.`);
          // If we are here, it means no error was thrown (caught above), but we are still not COMPLETED/FAILED.
          // This usually implies a logic bug or race condition where the explicit 'COMPLETED' update was missed.
          await pool.query(
            `UPDATE gmail_sync_jobs 
              SET status = 'COMPLETED', 
                  current_step = 'COMPLETED', 
                  progress = 100, 
                  last_update_at = NOW(), 
                  completed_at = NOW(),
                  errors = COALESCE(errors, '[]'::jsonb) || $1
              WHERE id = $2`,
            [JSON.stringify([{ warning: 'Job force-completed by safety net' }]), jobId]
          );
        }
      }
    } catch (finalError) {
      logger.error(`[HistoricalScanner] Critical: Failed to execute safety net for job ${jobId}`, finalError);
    }
  }
}

// CLI Support
if (require.main === module) {
  const userId = process.argv[2];
  const jobId = process.argv[3] || `manual-${Date.now()}`;
  if (!userId) { logger.error('Usage: <userId> [jobId]'); process.exit(1); }

  (async () => {
    try {
      const { rows } = await pool.query('SELECT id FROM gmail_sync_jobs WHERE id = $1', [jobId]);
      if (rows.length === 0) {
        console.log(`[CLI] Creating job ${jobId}...`);
        await pool.query(
          `INSERT INTO gmail_sync_jobs (id, user_id, status, current_step, started_at)
                 VALUES ($1, $2, 'pending', 'INITIALIZING', NOW())`,
          [jobId, userId]
        );
      }
    } catch (e) {
      console.error('[CLI] Failed to create job record', e);
      process.exit(1);
    }

    runHistoricalScan(userId, jobId).catch(err => logger.error(err));
  })();
}

