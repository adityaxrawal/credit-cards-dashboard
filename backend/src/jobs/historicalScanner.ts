import { decrypt } from '../utils/helpers/encryption';
import pool, { safeQuery } from '../lib/db';
import * as gmailClient from '../lib/gmailClient';
import { GmailFetcherService } from '../services/gmail/fetcher';
import logger from '../utils/infrastructure/logger';
import { WorkflowLogger } from '../utils/infrastructure/workflowLogger';
import { universalPipeline } from '../services/transactions/pipeline/UniversalTransactionPipeline';
import { GptQueueManager } from '../services/transactions/pipeline/GptQueueManager';
import { SimplifiedEmail } from '../types/transaction.types'; // Use new types
import dayjs from 'dayjs';
import { broadcastProcessingUpdate, broadcastJobComplete } from '../services/alerts/WebSocketState';

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
  console.log(`\n\n[JOB START] Historical Scan ${jobId} for user ${userId}`);
  console.log(`[JOB CONF] Date Range: ${fromDate || '90 days ago'} -> ${toDate || 'Now'}`);
  WorkflowLogger.log('FETCH', `Starting historical scan (Fast Mode)`, { jobId, userId });

  try {
    // 1. Validate User & Token
    const { rows: users } = await safeQuery(
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
    const query = `after:${from} before:${to} in:inbox -category:promotions -category:social`;

    // Initialize job status
    await safeQuery(
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
    const FETCH_BATCH_SIZE = 100;  // Increased for throughput
    const HIGH_WATER_MARK = 500;  // Run ahead aggressively
    const LOW_WATER_MARK = 100;   // Resume sooner

    // --- GPT QUEUE ---
    const gptQueueManager = new GptQueueManager();
    gptQueueManager.start();

    // --- PRODUCER LOOP (FETCH) ---
    const fetchLoop = async () => {
      let pageToken: string | undefined = undefined;
      console.log(`[PHASE: FETCH] Starting fetch loop with batch size ${FETCH_BATCH_SIZE}`);

      try {
        do {
          // Backpressure check
          if (processingQueue.length > HIGH_WATER_MARK) {
            console.log(`[FETCH] Backpressure active. Queue size: ${processingQueue.length}. Pausing...`);
            WorkflowLogger.log('FETCH', `Backpressure: Queue size ${processingQueue.length}. Pausing fetch...`, { jobId });
            while (processingQueue.length > LOW_WATER_MARK) {
              await new Promise(r => setTimeout(r, 200));
            }
            console.log(`[FETCH] Resuming fetch. Queue drained to ${processingQueue.length}.`);
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

            // Broadcast fetch progress immediately
            broadcastProcessingUpdate(jobId, {
              status: 'PROCESSING',
              currentStep: 'FETCHING',
              totalEmails: totalFetched,
              totalProcessed: stats.success + stats.failed + stats.terminated + stats.duplicate + stats.needs_review,
              totalTransactions: stats.success,
              totalErrors: stats.failed,
              queueStatus: { queue1: processingQueue.length, queue2: 0, queue3: 0 }
            });
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
          console.error(`[JOB FAIL] Circuit breaker tripped! Aborting job ${jobId}`);
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
        // With semaphore=30, process 15 emails at a time for maximum throughput
        const batchSize = 15;
        const batch = processingQueue.splice(0, batchSize);
        const batchStartTime = Date.now();
        console.log(`\n[PROCESS] Batch Start. Size: ${batch.length}. Queue Rem: ${processingQueue.length}`);

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

        // Update DB/WS more frequently - every batch (approx 15 items)
        const processed = stats.success + stats.failed + stats.terminated + stats.duplicate + stats.needs_review;
        if (true) { // Always update after a batch
          await updateJobStats(jobId, totalFetched, stats);
        }
      }
      logger.info(`[PROCESS] Consumer loop finished. Queue empty and fetch complete.`);
    };

    // --- PROCESS SINGLE EMAIL ---
    const processSingleEmail = async (cleanEmail: SimplifiedEmail) => {
      const fetchAttachment = async (msgId: string, attId: string) => {
        return gmailClient.getAttachment(refreshToken, msgId, attId);
      };

      // Delegate to Universal Pipeline with skipGpt option
      // We pass skipGpt: true to offload low-confidence items to the background workers
      const result = await universalPipeline.processEmailInternal(userId, cleanEmail, jobId, fetchAttachment, { skipGpt: true });

      // Update Stats based on result
      if (result.status === 'success') stats.success++;
      else if (result.status === 'terminated') stats.terminated++;
      else if (result.status === 'duplicate') stats.duplicate++;
      else if (result.status === 'needs_review') stats.needs_review++;
      else if (result.status === 'queued_for_gpt') {
        // Enqueue to GPT Manager
        gptQueueManager.enqueue({
          userId,
          cleanEmail: result.cleanEmail!, // Assert existing because status is queued_for_gpt
          rawEmail: cleanEmail,
          jobId,
          rawEmailId: result.rawEmailId || '',
          onComplete: () => {
            // We can update a separate counter if needed, or rely on job stats polling
          }
        });
        // We count this as "queued" for now, not success or failure yet.
        // Effectively "pending"
      }
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

      await safeQuery(
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

      // Broadcast real-time update via WebSocket
      broadcastProcessingUpdate(jid, {
        jobId: jid,
        status: 'PROCESSING',
        currentStep: 'PROCESSING_AND_FETCHING', // Unified step name to avoid flickering
        totalEmails: total,
        totalProcessed: processed,
        totalTransactions: curStats.success,
        totalErrors: curStats.failed,
        queueStatus: { queue1: processingQueue.length, queue2: 0, queue3: 0 }
      });
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

    // Wait for GPT Queue to drain
    logger.info(`[HistoricalScanner] Fetch/Rule pipeline done. Waiting for GPT Queue to drain...`);
    await gptQueueManager.drain();
    gptQueueManager.stop();

    // Merge GPT stats
    stats.success += gptQueueManager.stats.success;
    stats.failed += gptQueueManager.stats.failed;
    stats.terminated += gptQueueManager.stats.nonFinancial;
    // stats.queued is purely internal

    // Log completion metrics at INFO level representing new pipeline stats
    logger.info(`[HistoricalScanner] Scan ${jobId} completed`, {
      duration: `${duration.toFixed(1)}s`,
      totalFetched,
      fetchRate: `${fetchRate}/sec`,
      processRate: `${processRate}/sec`,
      stats,
      gptStats: gptQueueManager.stats
    });
    WorkflowLogger.log('COMPLETED', `Scan finished in ${duration}s. Rate: ${fetchRate}/sec`, { jobId, stats });


    // --- POST-PROCESSING ---
    // Initialize stats
    const postProcessingStats: { billsCreated: number; instrumentsCreated: number } = {
      billsCreated: 0,
      instrumentsCreated: 0
    };

    // Update status to indicate post-processing start
    await safeQuery(
      `UPDATE gmail_sync_jobs SET current_step = 'POST_PROCESSING_ANALYTICS', last_update_at = NOW() WHERE id = $1`,
      [jobId]
    );
    console.log(`[POST-PROC] Step: ANALYTICS for job ${jobId}`);
    // Broadcast status update
    broadcastProcessingUpdate(jobId, {
      status: 'PROCESSING',
      currentStep: 'POST_PROCESSING_ANALYTICS',
      totalProcessed: totalFetched,
      totalEmails: totalFetched,
      totalTransactions: stats.success,
      postProcessingStats
    });

    // After sync, invalidate caches so fresh data is fetched
    try {
      const { AnalyticsService } = await import('../services/analytics/AnalyticsService');
      await AnalyticsService.invalidateCache(userId);
      logger.info(`[HistoricalScanner] Analytics cache invalidated for user ${userId}`);
    } catch (cacheErr) {
      logger.warn(`[HistoricalScanner] Failed to invalidate analytics cache:`, cacheErr);
    }

    // Generate bills
    await safeQuery(
      `UPDATE gmail_sync_jobs SET current_step = 'POST_PROCESSING_BILLS', last_update_at = NOW() WHERE id = $1`,
      [jobId]
    );
    console.log(`[POST-PROC] Step: BILLS for job ${jobId}`);

    // Broadcast before starting bills (optional, but good to show step change)
    broadcastProcessingUpdate(jobId, {
      status: 'PROCESSING',
      currentStep: 'POST_PROCESSING_BILLS',
      totalProcessed: totalFetched,
      totalEmails: totalFetched,
      totalTransactions: stats.success,
      postProcessingStats
    });

    try {
      const { PostProcessingService } = await import('../services/processing/PostProcessingService');
      const billsCreated = await PostProcessingService.generateBillsFromTransactions(userId);
      postProcessingStats.billsCreated = billsCreated;

      // Broadcast update with bills count
      broadcastProcessingUpdate(jobId, {
        status: 'PROCESSING',
        currentStep: 'POST_PROCESSING_BILLS',
        totalProcessed: totalFetched,
        totalEmails: totalFetched,
        totalTransactions: stats.success,
        postProcessingStats
      });

      // Detect Cards
      await safeQuery(
        `UPDATE gmail_sync_jobs SET current_step = 'POST_PROCESSING_CARDS', last_update_at = NOW() WHERE id = $1`,
        [jobId]
      );
      console.log(`[POST-PROC] Step: CARDS for job ${jobId}`);
      broadcastProcessingUpdate(jobId, {
        status: 'PROCESSING',
        currentStep: 'POST_PROCESSING_CARDS',
        totalProcessed: totalFetched,
        totalEmails: totalFetched,
        totalTransactions: stats.success,
        postProcessingStats
      });

      const instrumentsCreated = await PostProcessingService.createInstrumentSuggestions(userId);
      postProcessingStats.instrumentsCreated = instrumentsCreated;

      logger.info(`[HistoricalScanner] Post-processing completed for user ${userId}`);
    } catch (postErr) {
      logger.warn(`[HistoricalScanner] Post-processing failed:`, postErr);
    }

    await safeQuery(
      `UPDATE gmail_sync_jobs SET status = 'COMPLETED', current_step = 'COMPLETED', progress = 100, emails_processed = total_messages, last_update_at = NOW(), completed_at = NOW() WHERE id = $1`,
      [jobId]
    );
    console.log(`✅ [JOB DONE] Job ${jobId} completed successfully.`);

    // Emit Final WebSocket Update
    broadcastJobComplete(jobId, {
      totalEmails: totalFetched,
      totalTransactions: stats.success,
      processed: totalFetched,
      status: 'COMPLETED',
      postProcessingStats
    });

    return { total: totalFetched };

  } catch (error) {
    WorkflowLogger.error('FAILED', `Scan failed`, error, { jobId });
    await safeQuery(
      `UPDATE gmail_sync_jobs SET status = 'FAILED', errors = $1, completed_at = NOW() WHERE id = $2`,
      [JSON.stringify([{ error: error instanceof Error ? error.message : 'Unknown' }]), jobId]
    );
    throw error;
  } finally {
    // SAFETY NET: Ensure job is never left hanging
    try {
      const { rows } = await safeQuery('SELECT status FROM gmail_sync_jobs WHERE id = $1', [jobId]);
      if (rows.length > 0) {
        const status = rows[0].status;
        const activeStatuses = ['PENDING', 'PROCESSING', 'FETCHING', 'GPT_PROCESSING'];

        if (activeStatuses.includes(status)) {
          logger.warn(`[HistoricalScanner] Safety Net: Job ${jobId} ended in ${status} state. Forcing COMPLETED.`);
          // If we are here, it means no error was thrown (caught above), but we are still not COMPLETED/FAILED.
          // This usually implies a logic bug or race condition where the explicit 'COMPLETED' update was missed.
          await safeQuery(
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

