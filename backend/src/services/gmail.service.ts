import * as gmailClient from '../lib/gmailClient';
import pool from '../lib/db';
import { runHistoricalScan } from '../jobs/historicalScanner';
import * as cardsQueries from '../db/queries/cards.queries';
import * as extractionService from '../services/extraction.service';
import * as transactionsService from '../services/transactions.service';
import { randomUUID } from 'crypto';
import logger from '../utils/logger';

/**
 * Get Gmail connection status
 */
export async function getConnectionStatus(userId: string) {
  const { rows } = await pool.query(
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
export async function connectGmail(userId: string, refreshToken: string) {
  // Store refresh token
  await pool.query(
    `UPDATE users SET google_refresh_token = $1, updated_at = NOW() WHERE id = $2`,
    [refreshToken, userId]
  );

  // Setup watch
  const topicName = process.env.GMAIL_PUBSUB_TOPIC || 'projects/YOUR_PROJECT/topics/gmail-notifications';
  const watchResult = await gmailClient.setupWatch(refreshToken, topicName);

  if (!watchResult) {
    throw new Error('Failed to setup Gmail watch');
  }

  // Update user with watch info
  const expiration = new Date(watchResult.expiration);
  await pool.query(
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
export async function disconnectGmail(userId: string) {
  const { rows } = await pool.query(
    'SELECT google_refresh_token FROM users WHERE id = $1',
    [userId]
  );

  if (rows.length > 0 && rows[0].google_refresh_token) {
    await gmailClient.stopWatch(rows[0].google_refresh_token);
  }

  await pool.query(
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
export async function triggerHistoricalScan(userId: string, fromDate?: Date, toDate?: Date) {
  const jobId = randomUUID();

  // Create job record in database
  await pool.query(
    `INSERT INTO gmail_sync_jobs (id, user_id, status, current_step, started_at)
     VALUES ($1, $2, 'pending', 'INITIALIZING', NOW())`,
    [jobId, userId]
  );

  // Start scan asynchronously (don't await)
  runHistoricalScan(userId, jobId, fromDate, toDate)
    .then(result => {
      logger.info(`[GmailService] Scan ${jobId} completed:`, result);
    })
    .catch(error => {
      logger.error(`[GmailService] Scan ${jobId} failed:`, error);
      // Update job status to failed
      pool.query(
        `UPDATE gmail_sync_jobs 
         SET status = 'failed', errors = $1, completed_at = NOW(), last_update_at = NOW()
         WHERE id = $2`,
        [JSON.stringify([{ error: error.message }]), jobId]
      ).catch(dbError => {
        logger.error(`[GmailService] Failed to update job status:`, dbError);
      });
    });

  return {
    jobId,
    status: 'pending',
    fromDate,
    toDate,
  };
}

/**
 * Get historical scan status
 */
export async function getHistoricalScanStatus(userId: string, jobId: string) {
  const { rows } = await pool.query(
    `SELECT id, status, current_step, total_messages, processed_count, saved_count, error_count, errors,
            started_at, completed_at, last_update_at, metadata
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
    processed: job.processed_count || 0,
    inserted: job.saved_count || 0,
    errors: job.error_count || 0,
    errorList: job.errors,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    lastUpdateAt: job.last_update_at,
    currentBatch: job.metadata?.currentBatch,
    totalBatches: job.metadata?.totalBatches,
  };
}

/**
 * Get latest scan job
 */
export async function getLatestJob(userId: string) {
  const { rows } = await pool.query(
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
 * Manual map a message to a card
 */
export async function manualMap(userId: string, messageId: string, cardInfo: {
  last4: string;
  bankName: string;
  cardType?: string;
}) {
  const jobId = randomUUID();

  // Create job record
  await pool.query(
    `INSERT INTO gmail_sync_jobs (id, user_id, status, current_step, started_at, metadata)
     VALUES ($1, $2, 'running', 'MANUAL_MAPPING', NOW(), $3)`,
    [jobId, userId, JSON.stringify({ messageId, cardInfo })]
  );

  // Run async
  (async () => {
    try {
      // 1. Ensure card exists
      let card = await cardsQueries.findCardByBankAndLastFour(userId, cardInfo.bankName, cardInfo.last4);
      if (!card) {
        card = await cardsQueries.createCard({
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
      const { rows } = await pool.query('SELECT google_refresh_token FROM users WHERE id = $1', [userId]);
      const refreshToken = rows[0]?.google_refresh_token;
      if (!refreshToken) throw new Error('Gmail not connected');

      const message = await gmailClient.getMessage(refreshToken, messageId);
      if (!message) throw new Error('Message not found');

      // 3. Extract (forcing the card context if possible, but our extractor is generic)
      const result = await extractionService.extractTransactionFromEmail(userId, message);

      if (result.status === 'success' && result.transaction) {
        await transactionsService.insertFromEmail(userId, {
          cardId: card.id,
          amount: result.transaction.amount,
          transactionDate: result.transaction.transactionDate,
          merchant: result.transaction.merchant,
          category: result.transaction.category,
          emailMessageId: messageId,
        });

        await pool.query(
          `UPDATE gmail_sync_jobs 
           SET status = 'completed', current_step = 'COMPLETED', processed_count = 1, saved_count = 1, completed_at = NOW()
           WHERE id = $1`,
          [jobId]
        );
      } else {
        throw new Error('Could not extract transaction details even with manual trigger');
      }

    } catch (error) {
      logger.error('Manual map failed:', error);
      await pool.query(
        `UPDATE gmail_sync_jobs 
         SET status = 'failed', errors = $1, completed_at = NOW()
         WHERE id = $2`,
        [JSON.stringify([{ error: error instanceof Error ? error.message : String(error) }]), jobId]
      );
    }
  })();

  return { jobId };
}
