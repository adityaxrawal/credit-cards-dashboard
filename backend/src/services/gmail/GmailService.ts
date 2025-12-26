import * as gmailClient from '../../lib/gmailClient';
import pool from '../../lib/db';
import { runHistoricalScan } from '../../jobs/historicalScanner';
import * as cardsQueries from '../../db/queries/cards.queries';
import { randomUUID } from 'crypto';
import { env } from '../../config/env';
import logger from '../../utils/infrastructure/logger';
import { encrypt, decrypt } from '../../utils/helpers/encryption';
import { TerminatorService } from '../infrastructure/termination/TerminatorService';
import { SimplifiedEmail } from '../../types/transaction.types';
import { universalPipeline } from '../transactions/pipeline/UniversalTransactionPipeline';
import { Pool } from 'pg';

export interface IGmailServiceDependencies {
  gmailClient: typeof gmailClient;
  pool: Pool;
  encrypt: typeof encrypt;
  decrypt: typeof decrypt;
  runHistoricalScan: typeof runHistoricalScan;
  terminatorService: typeof TerminatorService;
  universalPipeline: typeof universalPipeline;
  cardsQueries: typeof cardsQueries;
}

export class GmailService {
  constructor(private deps: IGmailServiceDependencies) { }

  /**
   * Get Gmail connection status
   */
  async getConnectionStatus(userId: string) {
    const { rows } = await this.deps.pool.query(
      `SELECT google_refresh_token, gmail_watch_expiration, gmail_history_id 
       FROM users WHERE id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      return { connected: false };
    }

    const user = rows[0];
    const hasRefreshToken = !!user.google_refresh_token;
    const watchExpiration = user.gmail_watch_expiration
      ? new Date(user.gmail_watch_expiration)
      : null;
    const isWatchActive = watchExpiration && watchExpiration > new Date();

    return {
      connected: hasRefreshToken,
      watchActive: isWatchActive,
      watchExpiration,
      historyId: user.gmail_history_id,
    };
  }

  /**
   * Connect Gmail (setup watch)
   */
  async connectGmail(userId: string, refreshToken: string) {
    console.log(`[GmailService] Connecting Gmail for user ${userId}`);
    // Store refresh token
    const encryptedToken = this.deps.encrypt(refreshToken);
    await this.deps.pool.query(
      `UPDATE users SET google_refresh_token = $1, updated_at = NOW() WHERE id = $2`,
      [encryptedToken, userId]
    );

    // Setup watch
    const topicName = env.GMAIL_PUBSUB_TOPIC || 'projects/YOUR_PROJECT/topics/gmail-notifications';
    const watchResult = await this.deps.gmailClient.setupWatch(refreshToken, topicName);

    if (!watchResult) {
      throw new Error('Failed to setup Gmail watch');
    }

    // Update user with watch info
    const expiration = new Date(watchResult.expiration);
    await this.deps.pool.query(
      `UPDATE users 
       SET gmail_history_id = $1, gmail_watch_expiration = $2, updated_at = NOW()
       WHERE id = $3`,
      [watchResult.historyId, expiration, userId]
    );

    return {
      connected: true,
      watchExpiration: expiration,
      historyId: watchResult.historyId,
    };
  }

  /**
   * Disconnect Gmail
   */
  async disconnectGmail(userId: string) {
    const { rows } = await this.deps.pool.query(
      'SELECT google_refresh_token FROM users WHERE id = $1',
      [userId]
    );

    if (rows.length > 0 && rows[0].google_refresh_token) {
      const rawToken = this.deps.decrypt(rows[0].google_refresh_token);
      await this.deps.gmailClient.stopWatch(rawToken);
    }

    await this.deps.pool.query(
      `UPDATE users 
       SET google_refresh_token = NULL, gmail_history_id = NULL, gmail_watch_expiration = NULL, updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    return { connected: false };
  }

  /**
   * Trigger historical scan
   */
  async triggerHistoricalScan(userId: string, fromDate?: Date, toDate?: Date) {
    console.log(`[GmailService] Triggering historical scan for user ${userId}`, { fromDate, toDate });
    // Check for existing active job
    const latestJob = await this.getLatestJob(userId);
    const activeStatuses = ['PENDING', 'PROCESSING', 'FETCHING', 'GPT_PROCESSING'];

    if (latestJob && activeStatuses.includes(latestJob.status)) {
      // Check for staleness (e.g. no updates for 30 minutes)
      const lastUpdate = latestJob.lastUpdateAt ? new Date(latestJob.lastUpdateAt) : new Date(latestJob.startedAt);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastUpdate.getTime()) / 1000 / 60;

      if (diffMinutes < 30) {
        logger.info(`[GmailService] Scan already running for user ${userId}: ${latestJob.jobId}`);
        return {
          jobId: latestJob.jobId,
          status: latestJob.status,
          fromDate: fromDate, // Preserving request params in response for consistency
          toDate: toDate,
          message: 'A scan is already in progress',
          existingJob: latestJob
        };
      }

      // Job is stale, mark as failed and proceed
      logger.warn(`[GmailService] Found stale job ${latestJob.jobId} (last update ${diffMinutes.toFixed(0)} mins ago). Marking as FAILED.`);
      logger.info(`[GmailService] Updating stale job status...`);
      await this.deps.pool.query(
        `UPDATE gmail_sync_jobs 
         SET status = 'FAILED', errors = $1, completed_at = NOW(), last_update_at = NOW()
         WHERE id = $2`,
        [JSON.stringify([{ error: 'Job marked as stale/abandoned due to inactivity' }]), latestJob.jobId]
      );
      logger.info(`[GmailService] Stale job updated.`);
    }


    const jobId = randomUUID();

    // Create job record in database
    await this.deps.pool.query(
      `INSERT INTO gmail_sync_jobs (id, user_id, status, current_step, started_at)
       VALUES ($1, $2, 'PENDING', 'INITIALIZING', NOW())`,
      [jobId, userId]
    );

    // Start scan asynchronously (don't await)
    this.deps.runHistoricalScan(userId, jobId, fromDate, toDate)
      .then(result => {
        logger.info(`[GmailService] Scan ${jobId} completed:`, result);
      })
      .catch(error => {
        logger.error(`[GmailService] Scan ${jobId} failed:`, error);
        // Update job status to failed
        this.deps.pool.query(
          `UPDATE gmail_sync_jobs 
           SET status = 'FAILED', errors = $1, completed_at = NOW(), last_update_at = NOW()
           WHERE id = $2`,
          [JSON.stringify([{ error: error.message }]), jobId]
        ).catch(dbError => {
          logger.error(`[GmailService] Failed to update job status:`, dbError);
        });
      });

    return {
      jobId,
      status: 'PENDING',
      fromDate,
      toDate,
    };
  }

  /**
   * Get historical scan status
   */
  async getHistoricalScanStatus(userId: string, jobId: string) {
    const { rows } = await this.deps.pool.query(
      `SELECT id, status, current_step, total_messages, processed_count, saved_count, error_count, errors,
              started_at, completed_at, last_update_at, metadata, emails_fetched, progress,
              rule_based_success, rule_based_failure, queued_for_gpt, terminated_count
       FROM gmail_sync_jobs
       WHERE id = $1 AND user_id = $2`,
      [jobId, userId]
    );

    if (rows.length === 0) {
      throw new Error('Job not found');
    }

    const job = rows[0];

    return {
      jobId: job.id,
      status: job.status,
      currentStep: job.current_step,
      total: job.total_messages || 0,
      fetched: job.emails_fetched || 0,
      progress: job.progress || 0,
      processed: job.processed_count || 0,
      inserted: job.saved_count || 0,
      errors: job.error_count || 0,
      errorList: job.errors,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      lastUpdateAt: job.last_update_at,
      currentBatch: job.metadata?.currentBatch,
      totalBatches: job.metadata?.totalBatches,
      // NEW: Breakdown metrics
      breakdown: {
        rule_based_success: job.rule_based_success || 0,
        rule_based_failure: job.rule_based_failure || 0,
        queued_for_gpt: job.queued_for_gpt || 0,
        terminated: job.terminated_count || 0,
      }
    };
  }

  /**
   * Get terminator report
   */
  async getTerminatorReport(userId: string, startDate: Date, endDate: Date) {
    return await this.deps.terminatorService.getReport(userId, startDate, endDate);
  }

  /**
   * Get latest scan job
   */
  async getLatestJob(userId: string) {
    const { rows } = await this.deps.pool.query(
      `SELECT id, status, current_step, total_messages, processed_count, saved_count, error_count, errors,
              started_at, completed_at, last_update_at
       FROM gmail_sync_jobs
       WHERE user_id = $1
       ORDER BY started_at DESC
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return null;
    }

    const job = rows[0];

    return {
      jobId: job.id,
      status: job.status,
      currentStep: job.current_step,
      total: job.total_messages || 0,
      fetched: job.emails_fetched || 0,
      progress: job.progress || 0,
      processed: job.processed_count || 0,
      inserted: job.saved_count || 0,
      errors: job.error_count || 0,
      errorList: job.errors,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      lastUpdateAt: job.last_update_at,
    };
  }

  /**
   * Get last successful sync timestamp
   */
  async getLastSuccessfulSync(userId: string) {
    const { rows } = await this.deps.pool.query(
      `SELECT completed_at
       FROM gmail_sync_jobs
       WHERE user_id = $1 AND status = 'completed'
       ORDER BY completed_at DESC
       LIMIT 1`,
      [userId]
    );

    return rows.length > 0 ? rows[0].completed_at : null;
  }

  /**
   * Manual map a message to a card
   */
  async manualMap(userId: string, messageId: string, cardInfo: {
    last4: string;
    bankName: string;
    cardType?: string;
  }) {
    console.log(`[GmailService] Manual map for user ${userId}, message ${messageId}`, cardInfo);
    const jobId = randomUUID();

    // Create job record
    await this.deps.pool.query(
      `INSERT INTO gmail_sync_jobs (id, user_id, status, current_step, started_at, metadata)
       VALUES ($1, $2, 'PROCESSING', 'MANUAL_MAPPING', NOW(), $3)`,
      [jobId, userId, JSON.stringify({ messageId, cardInfo })]
    );

    // Run async
    (async () => {
      try {
        // 1. Ensure card exists
        let card = await this.deps.cardsQueries.findCardByBankAndLastFour(userId, cardInfo.bankName, cardInfo.last4);
        if (!card) {
          card = await this.deps.cardsQueries.createCard({
            userId,
            bankName: cardInfo.bankName,
            lastFour: cardInfo.last4,
            cardName: `${cardInfo.bankName} ${cardInfo.last4}`,
            billDate: 1, // Default
            dueDate: 10, // Default
            creditLimit: 0 // Default
          });
        }

        // 2. Fetch message
        const { rows } = await this.deps.pool.query('SELECT google_refresh_token FROM users WHERE id = $1', [userId]);
        const refreshToken = rows[0]?.google_refresh_token;
        if (!refreshToken) throw new Error('Gmail not connected');
        // Decrypt
        const rawToken = this.deps.decrypt(refreshToken);

        const message = await this.deps.gmailClient.getMessage(rawToken, messageId);
        if (!message) throw new Error('Message not found');

        // 3. Process via Universal Pipeline
        const simpleEmail: SimplifiedEmail = {
          messageId: message.id,
          threadId: message.threadId,
          from: message.from,
          to: message.to,
          subject: message.subject,
          body: message.bodyText || message.snippet,
          internalDate: message.date.getTime(),
          snippet: message.snippet
        };

        const fetchAttachment = async (msgId: string, attId: string) =>
          this.deps.gmailClient.getAttachment(rawToken, msgId, attId);

        const result = await this.deps.universalPipeline.processEmail(userId, simpleEmail, jobId, fetchAttachment);

        if (result.status === 'success' || result.status === 'needs_review' || result.status === 'duplicate') {
          // For manualMap, we ensure the transaction is linked to the user-provided card
          // even if the pipeline resolved it differently or flagged it for review.

          const txnId = (result as any).transactionId;
          if (txnId) {
            // Force link to the user-provided card
            await this.deps.pool.query(
              `UPDATE transactions SET card_id = $1, instrument_id = (
                SELECT id FROM user_instruments 
                WHERE user_id = $2 AND bank_name = $3 AND instrument_type = 'credit_card' 
                AND account_number_masked LIKE $4 LIMIT 1
              ) WHERE id = $5`,
              [card.id, userId, cardInfo.bankName, `%${cardInfo.last4}`, txnId]
            );
          }

          await this.deps.pool.query(
            `UPDATE gmail_sync_jobs 
             SET status = 'COMPLETED', current_step = 'COMPLETED', processed_count = 1, saved_count = 1, completed_at = NOW()
             WHERE id = $1`,
            [jobId]
          );
        } else {
          throw new Error(`Pipeline processing failed: ${result.status} ${(result as any).reason || ''}`);
        }

      } catch (error) {
        logger.error('Manual map failed:', error);
        await this.deps.pool.query(
          `UPDATE gmail_sync_jobs 
           SET status = 'FAILED', errors = $1, completed_at = NOW()
           WHERE id = $2`,
          [JSON.stringify([{ error: error instanceof Error ? error.message : String(error) }]), jobId]
        );
      }
    })();

    return { jobId };
  }

  /**
   * Get Pipeline Statistics (Queue depths, etc)
   */
  async getPipelineStats(userId: string) {
    const connection = await this.getConnectionStatus(userId);
    const queueStats = { pending: 0 }; // Queue depth tracking to be updated for new batching if needed
    const latestJob = await this.getLatestJob(userId);
    // Status check MUST match the new UPPERCASE states
    const isJobRunning = latestJob?.status === 'PENDING' || latestJob?.status === 'PROCESSING' || latestJob?.status === 'FETCHING' || latestJob?.status === 'GPT_PROCESSING';

    return {
      connection,
      queues: queueStats,
      activeJob: isJobRunning ? {
        id: latestJob?.jobId,
        status: latestJob?.status,
        progress: latestJob?.processed ? `${latestJob.processed}/${latestJob.total}` : '0/0'
      } : null
    };
  }
}

// Default Singleton Instance
export const gmailService = new GmailService({
  gmailClient,
  pool,
  encrypt,
  decrypt,
  runHistoricalScan,
  terminatorService: TerminatorService,
  universalPipeline,
  cardsQueries
});
