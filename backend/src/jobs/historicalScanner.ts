import { decrypt } from '../utils/encryption';
import pool from '../lib/db';
import * as gmailClient from '../lib/gmailClient';
import { GmailFetcherService } from '../services/gmail/fetcher';
import { SanitizerService } from '../services/sanitize/sanitizer';
import { FilterService } from '../services/filters/filterService';
import { RuleProcessor } from '../services/rules/ruleProcessor';
import { TerminatorService } from '../services/terminator/terminator';
import { gptQueue } from '../services/queue/gptQueue';
import * as transactionsService from '../services/transactions.service';
import dayjs from 'dayjs';
import logger from '../utils/logger';
import { WorkflowLogger } from '../utils/workflowLogger';
import { PipelineService } from '../services/pipeline/pipeline.service';
import { PdfParser } from '../services/extraction/pdfParser';

import { SimplifiedEmail } from '../types';
import '../services/gpt/gptProcessor'; // Import Side-effect: Attaches listener to gptQueue

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
    const senderFilter = FilterService.SENDER_DOMAINS.map(d => `from:"${d}"`).join(' OR ');
    const query = `after:${from} before:${to} (${senderFilter})`;

    await pool.query(
      `UPDATE gmail_sync_jobs 
       SET status = 'running', 
           current_step = 'FETCHING_AND_PROCESSING', 
           total_messages = 0, 
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
    const stats = { success: 0, failed: 0, queuedGpt: 0, terminated: 0 };

    // Config
    const FETCH_BATCH_SIZE = 200; // List limit
    const HIGH_WATER_MARK = 500;  // Pause fetching if queue exceeds this (Backpressure)
    const LOW_WATER_MARK = 100;   // Resume fetching if queue drops below this

    // --- PRODUCER LOOP (FETCH) ---
    const fetchLoop = async () => {
      let pageToken: string | undefined = undefined;

      try {
        do {
          // Backpressure check
          if (processingQueue.length > HIGH_WATER_MARK) {
            WorkflowLogger.log('FETCH', `Backpressure: Queue size ${processingQueue.length}. Pausing fetch...`, { jobId });
            while (processingQueue.length > LOW_WATER_MARK) {
              await new Promise(r => setTimeout(r, 100));
            }
            WorkflowLogger.log('FETCH', `Resuming fetch...`, { jobId });
          }

          WorkflowLogger.log('FETCH', `Listing batch...`, { jobId });

          // Note: fetchBatch internally now uses our optimized gmailClient parameters
          const { messages, nextPageToken } = await GmailFetcherService.fetchBatch(refreshToken, query, FETCH_BATCH_SIZE, pageToken);
          pageToken = nextPageToken;

          if (messages.length > 0) {
            totalFetched += messages.length;
            processingQueue.push(...messages);
            WorkflowLogger.log('FETCH', `Pushed ${messages.length} to queue. Total Fetched: ${totalFetched}`, { jobId, queueSize: processingQueue.length });
          }

        } while (pageToken);
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
      while (isFetching || processingQueue.length > 0) {
        if (processingQueue.length === 0) {
          // Wait briefly for producer
          await new Promise(r => setTimeout(r, 50));
          continue;
        }

        // Take a chunk off the queue
        const batch = processingQueue.splice(0, 50); // Process 50 at a time
        logger.info(`[PROCESS] Processing batch of ${batch.length} emails. Queue size: ${processingQueue.length}`);

        // Process this batch in parallel
        await Promise.all(batch.map(async (email) => {
          try {
            await processSingleEmail(email);
          } catch (e) {
            console.error(`Error processing email ${email.messageId}`, e);
            stats.failed++;
          }
        }));

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

      // Delegate to Unified Pipeline
      const result = await PipelineService.processEmail(userId, cleanEmail, jobId, fetchAttachment);

      // Update Stats based on result
      if (result === 'success') stats.success++;
      else if (result === 'terminated') stats.terminated++;
      else if (result === 'queued_gpt') stats.queuedGpt++;
      else if (result === 'failed') stats.failed++;
    };

    const updateJobStats = async (jid: string, total: number, curStats: any) => {
      await pool.query(
        `UPDATE gmail_sync_jobs 
             SET total_messages = $1, rule_based_success = $2, rule_based_failure = $3, queued_for_gpt = $4, terminated_count = $5, last_update_at = NOW()
             WHERE id = $6`,
        [total, curStats.success, curStats.failed, curStats.queuedGpt, curStats.terminated, jid]
      );
      // WS Update could go here
    };


    // --- LAUNCH PARALLEL LOOPS ---
    WorkflowLogger.log('FETCH', `Launching parallel Fetch and Process loops`, { jobId });
    const start = Date.now();

    await Promise.all([
      fetchLoop(),
      processLoop() // This will finish when fetchLoop finishes AND queue is empty
    ]);

    const duration = (Date.now() - start) / 1000;
    WorkflowLogger.log('COMPLETED', `Scan finished in ${duration}s. Rate: ${Math.round(totalFetched / duration)}/sec`, { jobId, stats });


    // --- CLEANUP & FLUSH ---
    WorkflowLogger.log('GPT_PROCESSING', `Flushing GPT queue...`, { jobId, queueSize: gptQueue.length });
    (gptQueue as any).flush();

    // Slight wait for GPT to pickup
    let retries = 0;
    while ((gptQueue.length > 0) && retries < 10) { await new Promise(r => setTimeout(r, 500)); retries++; }

    await pool.query(
      `UPDATE gmail_sync_jobs SET status = 'completed', current_step = 'COMPLETED', progress = 100, last_update_at = NOW() WHERE id = $1`,
      [jobId]
    );

    // Emit Final WebSocket Update
    const { broadcastJobComplete } = await import('../services/webSocketService');
    broadcastJobComplete(jobId, {
      totalEmails: totalFetched,
      totalTransactions: stats.success,
      processed: totalFetched,
      status: 'completed'
    });

    return { total: totalFetched };

  } catch (error) {
    WorkflowLogger.error('FAILED', `Scan failed`, error, { jobId });
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
  if (!userId) { logger.error('Usage: <userId> [jobId]'); process.exit(1); }

  (async () => {
    // Ensure Job Exists
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
