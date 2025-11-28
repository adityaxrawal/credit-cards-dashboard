import * as gmailClient from '../lib/gmailClient';
import pool from '../lib/db';
import { runHistoricalScan } from '../jobs/historicalScanner';

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
  const jobId = `scan-${userId}-${Date.now()}`;
  
  // Create job record in database
  await pool.query(
    `INSERT INTO scan_jobs (id, user_id, status, current_step, from_date, to_date, started_at)
     VALUES ($1, $2, 'pending', 'INITIALIZING', $3, $4, NOW())`,
    [jobId, userId, fromDate || null, toDate || null]
  );
  
  // Start scan asynchronously (don't await)
  runHistoricalScan(userId, jobId, fromDate, toDate)
    .then(result => {
      console.log(`[GmailService] Scan ${jobId} completed:`, result);
    })
    .catch(error => {
      console.error(`[GmailService] Scan ${jobId} failed:`, error);
      // Update job status to failed
      pool.query(
        `UPDATE scan_jobs 
         SET status = 'failed', error_message = $1, completed_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [error.message, jobId]
      ).catch(dbError => {
        console.error(`[GmailService] Failed to update job status:`, dbError);
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
    `SELECT id, status, current_step, total, processed, inserted, errors, 
            from_date, to_date, started_at, completed_at, error_message, created_at
     FROM scan_jobs
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
    total: job.total || 0,
    processed: job.processed || 0,
    inserted: job.inserted || 0,
    errors: job.errors || 0,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    errorMessage: job.error_message,
  };
}

/**
 * Update scan job progress (called from historical scanner)
 */
export async function updateScanJobProgress(
  jobId: string,
  data: {
    status?: string;
    currentStep?: string;
    total?: number;
    processed?: number;
    inserted?: number;
    errors?: number;
  }
) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (data.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(data.status);
  }
  if (data.currentStep !== undefined) {
    updates.push(`current_step = $${paramIndex++}`);
    values.push(data.currentStep);
  }
  if (data.total !== undefined) {
    updates.push(`total = $${paramIndex++}`);
    values.push(data.total);
  }
  if (data.processed !== undefined) {
    updates.push(`processed = $${paramIndex++}`);
    values.push(data.processed);
  }
  if (data.inserted !== undefined) {
    updates.push(`inserted = $${paramIndex++}`);
    values.push(data.inserted);
  }
  if (data.errors !== undefined) {
    updates.push(`errors = $${paramIndex++}`);
    values.push(data.errors);
  }
  
  if (data.status === 'completed' || data.status === 'failed') {
    updates.push(`completed_at = NOW()`);
  }
  
  updates.push(`updated_at = NOW()`);
  values.push(jobId);
  
  const query = `UPDATE scan_jobs SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
  
  await pool.query(query, values);
}
