import pool from '../../lib/db';
import logger from '../../utils/infrastructure/logger';

interface EmailContext {
    userId: string;
    emailId: string;
    retryCount: number;
    jobId?: string;
}

export class RetryQueueService {
    /**
     * Queue an email for retry
     */
    static async queueForRetry(
        context: EmailContext,
        nextRetryAt: Date
    ): Promise<void> {
        try {
            await pool.query(
                `INSERT INTO processing_retry_queue (
          email_id, user_id, retry_count, next_retry_at, 
          last_error_type, scan_job_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (email_id, user_id) DO UPDATE SET
          retry_count = processing_retry_queue.retry_count + 1,
          next_retry_at = EXCLUDED.next_retry_at,
          updated_at = NOW()`,
                [
                    context.emailId,
                    context.userId,
                    context.retryCount + 1,
                    nextRetryAt,
                    'RETRY',
                    context.jobId
                ]
            );
            logger.info(`[RetryQueueService] Queued ${context.emailId} for retry at ${nextRetryAt.toISOString()}`);
        } catch (err) {
            logger.error('[RetryQueueService] Failed to queue for retry', err);
        }
    }
}
