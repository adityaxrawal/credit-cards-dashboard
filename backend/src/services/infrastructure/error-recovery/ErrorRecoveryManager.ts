import pool from '../../../lib/db';
import logger from '../../../utils/infrastructure/logger';
import { isPostgresError } from '../../../utils/validation/errorTypeGuards';
import { ManualReviewService } from './ManualReviewService';
import { RetryQueueService } from './RetryQueueService';

export type ErrorType =
    | 'DB_CONNECTION'
    | 'TIMEOUT'
    | 'VALIDATION'
    | 'GPT_FAILURE'
    | 'EXTRACTION_FAILED'
    | 'CLASSIFICATION_FAILED'
    | 'UNKNOWN';

export type RecoveryAction = 'RETRY' | 'MANUAL_REVIEW' | 'SKIP' | 'FALLBACK';

interface EmailContext {
    userId: string;
    emailId: string;
    subject?: string;
    snippet?: string;
    sender?: string;
    currentStage: string;
    retryCount: number;
    jobId?: string;
    rawEmailId?: string;
}

interface ErrorRecoveryResult {
    action: RecoveryAction;
    reason: string;
    nextRetryAt?: Date;
}

export class ErrorRecoveryManager {
    private static readonly MAX_RETRIES = 3;
    private static readonly BASE_RETRY_DELAY_MS = 1000;

    /**
     * Handle an email processing error and determine the appropriate recovery action
     */
    static async handleProcessingError(
        error: Error,
        context: EmailContext
    ): Promise<ErrorRecoveryResult> {
        // 1. Log the error
        await this.logError(error, context);

        // 2. Classify the error
        const errorType = this.classifyError(error);

        // 3. Determine recovery action based on error type and retry count
        const result = this.determineRecoveryAction(errorType, context);

        // 4. Implement action
        if (result.action === 'RETRY' && result.nextRetryAt) {
            await RetryQueueService.queueForRetry(context, result.nextRetryAt);
        } else if (result.action === 'MANUAL_REVIEW') {
            await ManualReviewService.markForManualReview(context, result.reason);
        }

        return result;
    }

    /**
     * Classify an error into a known error type
     */
    private static classifyError(error: Error): ErrorType {
        const msg = error.message.toLowerCase();
        const code = isPostgresError(error) ? error.code : undefined;

        // Database connection issues
        if (
            msg.includes('connection') ||
            msg.includes('pool') ||
            msg.includes('econnreset') ||
            code === '57P01' || // admin_shutdown
            code === '57P02' || // crash_shutdown
            code === '57P03'    // cannot_connect_now
        ) {
            return 'DB_CONNECTION';
        }

        // Timeout errors
        if (msg.includes('timeout') || msg.includes('timed out')) {
            return 'TIMEOUT';
        }

        // Validation errors
        if (
            msg.includes('validation') ||
            msg.includes('parse') ||
            msg.includes('invalid')
        ) {
            return 'VALIDATION';
        }

        // GPT/OpenAI errors
        if (
            msg.includes('gpt') ||
            msg.includes('openai') ||
            msg.includes('rate limit') ||
            msg.includes('api')
        ) {
            return 'GPT_FAILURE';
        }

        // Extraction errors
        if (msg.includes('extract') || msg.includes('extractor')) {
            return 'EXTRACTION_FAILED';
        }

        // Classification errors
        if (msg.includes('classif') || msg.includes('detector')) {
            return 'CLASSIFICATION_FAILED';
        }

        return 'UNKNOWN';
    }

    /**
     * Determine the appropriate recovery action
     */
    private static determineRecoveryAction(
        errorType: ErrorType,
        context: EmailContext
    ): ErrorRecoveryResult {
        switch (errorType) {
            case 'DB_CONNECTION':
            case 'TIMEOUT':
                // Recoverable errors - retry with backoff
                if (context.retryCount < this.MAX_RETRIES) {
                    const delayMs = this.BASE_RETRY_DELAY_MS * Math.pow(2, context.retryCount);
                    return {
                        action: 'RETRY',
                        reason: `Recoverable error (${errorType}), scheduling retry`,
                        nextRetryAt: new Date(Date.now() + delayMs)
                    };
                }
                // Max retries exceeded
                return {
                    action: 'MANUAL_REVIEW',
                    reason: `Max retries (${this.MAX_RETRIES}) exceeded for ${errorType}`
                };

            case 'GPT_FAILURE':
                // Try fallback to rule-based classification
                return {
                    action: 'FALLBACK',
                    reason: 'GPT failed, attempting rule-based fallback'
                };

            case 'VALIDATION':
            case 'EXTRACTION_FAILED':
            case 'CLASSIFICATION_FAILED':
                // Send to manual review
                return {
                    action: 'MANUAL_REVIEW',
                    reason: `${errorType} requires human review`
                };

            default:
                // Unknown errors go to manual review
                return {
                    action: 'MANUAL_REVIEW',
                    reason: 'Unknown error type requires human review'
                };
        }
    }

    /**
     * Log an error to the pipeline_error_logs table
     */
    private static async logError(error: Error, context: EmailContext): Promise<void> {
        try {
            await pool.query(
                `INSERT INTO pipeline_error_logs (
          email_id, user_id, error_type, error_message, error_stack,
          pipeline_stage, context, retry_count, scan_job_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
                [
                    context.emailId,
                    context.userId,
                    this.classifyError(error),
                    error.message,
                    error.stack,
                    context.currentStage,
                    JSON.stringify({
                        subject: context.subject,
                        snippet: context.snippet?.substring(0, 500),
                        sender: context.sender,
                        rawEmailId: context.rawEmailId
                    }),
                    context.retryCount,
                    context.jobId
                ]
            );
        } catch (logError: any) {
            // Don't swallow logging errors - they indicate critical infrastructure failure
            logger.error('[ErrorRecovery] Failed to log error to DB', logError);
            // Re-throw so the caller knows the audit trail is broken
            throw new Error(`Failed to log pipeline error: ${logError.message}`);
        }
    }

    /**
     * Get error statistics for monitoring
     */
    static async getErrorStats(
        userId: string,
        since: Date
    ): Promise<{
        byType: Array<{ error_type: string; count: number }>;
        byStage: Array<{ pipeline_stage: string; count: number }>;
        totalErrors: number;
        unresolvedCount: number;
    }> {
        const [byTypeResult, byStageResult, totalResult, unresolvedResult] = await Promise.all([
            pool.query(
                `SELECT error_type, COUNT(*) as count FROM pipeline_error_logs
         WHERE user_id = $1 AND created_at >= $2
         GROUP BY error_type ORDER BY count DESC`,
                [userId, since]
            ),
            pool.query(
                `SELECT pipeline_stage, COUNT(*) as count FROM pipeline_error_logs
         WHERE user_id = $1 AND created_at >= $2
         GROUP BY pipeline_stage ORDER BY count DESC`,
                [userId, since]
            ),
            pool.query(
                `SELECT COUNT(*) as total FROM pipeline_error_logs
         WHERE user_id = $1 AND created_at >= $2`,
                [userId, since]
            ),
            pool.query(
                `SELECT COUNT(*) as count FROM pipeline_error_logs
         WHERE user_id = $1 AND resolved = false`,
                [userId]
            )
        ]);

        return {
            byType: byTypeResult.rows.map(r => ({ error_type: r.error_type, count: parseInt(r.count, 10) })),
            byStage: byStageResult.rows.map(r => ({ pipeline_stage: r.pipeline_stage, count: parseInt(r.count, 10) })),
            totalErrors: parseInt(totalResult.rows[0].total, 10),
            unresolvedCount: parseInt(unresolvedResult.rows[0].count, 10)
        };
    }
}

