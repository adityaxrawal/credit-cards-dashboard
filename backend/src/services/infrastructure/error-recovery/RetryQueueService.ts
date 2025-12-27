import pool, { safeQuery } from '../../../lib/db';
import logger from '../../../utils/infrastructure/logger';

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
            await safeQuery(
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

    /**
     * Move an email to the Dead Letter Queue (DLQ)
     */
    static async moveToDLQ(
        context: EmailContext,
        reason: string
    ): Promise<void> {
        try {
            await safeQuery(
                `UPDATE processing_retry_queue
                 SET is_dead_letter = true,
                     dlq_reason = $1,
                     updated_at = NOW(),
                     status = 'failed'
                 WHERE email_id = $2 AND user_id = $3`,
                [reason, context.emailId, context.userId]
            );
            logger.info(`[RetryQueueService] Moved ${context.emailId} to DLQ. Reason: ${reason}`);
        } catch (err) {
            logger.error('[RetryQueueService] Failed to move to DLQ', err);
        }
    }
}
