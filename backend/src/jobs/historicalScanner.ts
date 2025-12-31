import { decrypt } from '../utils/helpers/encryption';
import pool, { safeQuery } from '../lib/db';
import * as gmailClient from '../lib/gmailClient';
import { GmailFetcherService } from '../services/gmail/fetcher';
import logger from '../utils/infrastructure/logger';
import { WorkflowLogger } from '../utils/infrastructure/workflowLogger';
import { universalPipeline } from '../services/transactions/pipeline/UniversalTransactionPipeline';
// GptQueueManager removed
import { SimplifiedEmail } from '../types/transaction.types';
import { SanitizerService } from '../services/gmail/sanitize/sanitizer';
import dayjs from 'dayjs';
import { broadcastProcessingUpdate, broadcastJobComplete } from '../services/alerts/WebSocketState';
import { dbWriteQueueManager } from '../services/infrastructure/DbWriteQueueManager';
import { ProcessingWorkerPool } from '../services/infrastructure/ProcessingWorkerPool';
import { circuitBreakerManager } from '../services/infrastructure/CircuitBreakerManager';

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
    const stats = { success: 0, failed: 0, needs_review: 0, terminated: 0, duplicate: 0, billsDetected: 0 };
    // Error Collection
    const jobErrors: string[] = [];

    // Config
    const FETCH_BATCH_SIZE = 100;  // Increased for throughput
    const HIGH_WATER_MARK = 500;  // Run ahead aggressively
    const LOW_WATER_MARK = 100;   // Resume sooner
    const WORKER_CONCURRENCY = 50; // Fixed concurrency workers

    // Rate tracking
    let fetchStartTime = Date.now();
    let processStartTime = Date.now();
    let lastRateCalc = Date.now();
    let processedSinceLastCalc = 0;
    let fetchRate = 0;
    let processRate = 0;

    // GptQueueManager removed

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

          // Circuit Breaker for Gmail API
          const { messages, nextPageToken } = await circuitBreakerManager.withGmail(
            () => GmailFetcherService.fetchBatch(refreshToken, userId, query, FETCH_BATCH_SIZE, pageToken)
          );

          pageToken = nextPageToken;
          console.log(`[PHASE: FETCH] Fetched ${messages.length} messages in ${Date.now() - fetchStart}ms`);

          if (messages.length > 0) {
            totalFetched += messages.length;
            processingQueue.push(...messages as any[]);

            // Get real-time queue depths
            const dbDepths = dbWriteQueueManager.getQueueDepths();
            const totalDbQueue = Object.values(dbDepths).reduce((sum, d) => sum + d, 0);

            WorkflowLogger.log('FETCH', `Pushed ${messages.length} to queue. Total Fetched: ${totalFetched}`, { jobId, queueSize: processingQueue.length });

            // Broadcast fetch progress immediately
            // Only send totalTransactions if > 0 to prevent UI flickering
            broadcastProcessingUpdate(jobId, {
              status: 'PROCESSING',
              currentStep: 'FETCHING',
              totalEmails: totalFetched,
              totalProcessed: stats.success + stats.failed + stats.terminated + stats.duplicate + stats.needs_review,
              ...(stats.success > 0 && { totalTransactions: stats.success }),
              totalErrors: stats.failed,
              queueStatus: {
                queue1: processingQueue.length,
                queue2: totalDbQueue, // DB Writes

              }
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

    // --- CONSUMER LOOP (PROCESS) - Using Worker Pool ---
    const processLoop = async () => {
      logger.info(`[PROCESS] Starting consumer loop for job ${jobId}`);
      console.log(`\nStarting Worker Pool Process Loop (Concurrency: ${WORKER_CONCURRENCY})`);
      processStartTime = Date.now();

      let consecutiveErrors = 0;
      const MAX_CONSECUTIVE_ERRORS = 50;

      // Create worker pool for processing
      const workerPool = new ProcessingWorkerPool<SimplifiedEmail, void>(
        { concurrency: WORKER_CONCURRENCY, name: `EmailProcessor-${jobId}` },
        async (email) => {
          await processSingleEmail(email);
          processedSinceLastCalc++;
        },
        () => {
          consecutiveErrors = 0; // Reset on success
        },
        (email, error) => {
          console.error(`Error processing email ${email.messageId}`, error);
          stats.failed++;
          consecutiveErrors++;
        }
      );
      workerPool.start();

      // Feed emails to worker pool
      while (isFetching || processingQueue.length > 0) {
        // Circuit Breaker
        if (consecutiveErrors > MAX_CONSECUTIVE_ERRORS) {
          logger.error(`[PROCESS] Circuit breaker tripped! Over ${MAX_CONSECUTIVE_ERRORS} consecutive errors. Aborting job.`);
          console.error(`[JOB FAIL] Circuit breaker tripped! Aborting job ${jobId}`);
          isFetching = false;
          processingQueue.length = 0;
          break;
        }

        if (processingQueue.length === 0) {
          await new Promise(r => setTimeout(r, 50));
          continue;
        }

        // Submit items to worker pool (it handles concurrency internally)
        const batch = processingQueue.splice(0, Math.min(WORKER_CONCURRENCY, processingQueue.length));
        workerPool.submitBatch(batch);

        // Calculate rates periodically
        const now = Date.now();
        if (now - lastRateCalc >= 1000) {
          processRate = Math.round(processedSinceLastCalc / ((now - lastRateCalc) / 1000));
          processedSinceLastCalc = 0;
          lastRateCalc = now;
        }

        // Update DB/WS asynchronously - FIRE AND FORGET (non-blocking)
        const processed = stats.success + stats.failed + stats.terminated + stats.duplicate + stats.needs_review;
        void updateJobStats(jobId, totalFetched, stats);

        // Calculate total DB queue depth
        const dbDepths = dbWriteQueueManager.getQueueDepths();
        const totalDbQueue = Object.values(dbDepths).reduce((sum, d) => sum + d, 0);

        // Enhanced WebSocket update with queue depths and rates
        broadcastProcessingUpdate(jobId, {
          jobId,
          status: 'PROCESSING',
          currentStep: 'PROCESSING_AND_FETCHING',
          totalEmails: totalFetched,
          totalProcessed: processed,
          totalTransactions: stats.success,
          totalErrors: stats.failed,
          queueStatus: {
            queue1: processingQueue.length + workerPool.getQueueDepth(), // Total processing backlog
            queue2: totalDbQueue, // DB Writes

          }
        });

        // Small delay to prevent tight loop
        await new Promise(r => setTimeout(r, 10));
      }

      // Wait for worker pool to drain
      await workerPool.drain();
      workerPool.stop();

      const poolStats = workerPool.getStats();
      logger.info(`[PROCESS] Consumer loop finished. Pool stats: processed=${poolStats.totalProcessed}, failed=${poolStats.totalFailed}`);
    };

    // --- PROCESS SINGLE EMAIL ---
    const processSingleEmail = async (cleanEmail: SimplifiedEmail) => {
      const fetchAttachment = async (msgId: string, attId: string) => {
        return gmailClient.getAttachment(refreshToken, msgId, attId);
      };

      // Delegate to Universal Pipeline
      const result = await universalPipeline.processEmailInternal(userId, cleanEmail, jobId, fetchAttachment);

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

      // --- Bill Detection ---
      try {
        const { BillAutoService } = await import('../services/bills/BillAutoService');
        const sanitizedEmail = await SanitizerService.sanitize(cleanEmail);
        const bill = await BillAutoService.processEmailForBill(userId, sanitizedEmail);
        if (bill) {
          stats.billsDetected++;
          // logger.info(`[HistoricalScanner] Auto-created bill ${bill.id}`);
        }
      } catch (billErr) {
        logger.warn(`[HistoricalScanner] Bill auto-creation logic failed for ${cleanEmail.messageId}`, billErr);
      }
    };


    const updateJobStats = async (jid: string, total: number, curStats: any) => {
      // Logic for total processed
      const processed = curStats.success + curStats.failed + curStats.terminated + curStats.duplicate + curStats.needs_review;
      const progress = total > 0 ? Math.floor((processed / total) * 100) : 0;

      // Persist partial errors if any
      const errorsJson = jobErrors.length > 0 ? JSON.stringify(jobErrors) : '[]';

      // Queue DB write instead of awaiting - FIRE AND FORGET
      dbWriteQueueManager.enqueue('job_stats', {
        jobId: jid,
        total,
        processed,
        progress,
        success: curStats.success,
        failed: curStats.failed,
        needsReview: curStats.needs_review,
        terminated: curStats.terminated,
        errors: jobErrors
      });

      // Broadcast real-time update via WebSocket with enhanced data
      broadcastProcessingUpdate(jid, {
        jobId: jid,
        status: 'PROCESSING',
        currentStep: 'PROCESSING_AND_FETCHING',
        totalEmails: total,
        totalProcessed: processed,
        totalTransactions: curStats.success,
        totalErrors: curStats.failed,
        queueStatus: {
          queue1: processingQueue.length,
          queue2: dbWriteQueueManager.getQueueDepths().transactions || 0,

        }
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
    fetchRate = Math.round(totalFetched / duration);
    processRate = Math.round((stats.success + stats.failed + stats.terminated + stats.needs_review) / duration);

    // GPT Queue draining removed

    // Wait for DB Write Queue to drain
    logger.info(`[HistoricalScanner] Waiting for DB Write Queue to drain...`);
    await dbWriteQueueManager.drain();
    logger.info(`[HistoricalScanner] All queues drained.`);

    // GPT stats merging removed

    // Log completion metrics at INFO level representing new pipeline stats
    logger.info(`[HistoricalScanner] Scan ${jobId} completed`, {
      duration: `${duration.toFixed(1)}s`,
      totalFetched,
      fetchRate: `${fetchRate}/sec`,
      processRate: `${processRate}/sec`,
      stats
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

