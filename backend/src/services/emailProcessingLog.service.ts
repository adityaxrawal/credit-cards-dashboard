import { Pool } from 'pg';
import logger from '../utils/logger';

export interface ProcessingLogEntry {
    userId: string;
    emailMessageId: string;
    fromAddress: string;
    subject: string;
    processingStatus: 'filter_terminated' | 'rule_based_success' | 'rule_based_failed' | 'gpt_success' | 'gpt_failed' | 'invalid' | 'duplicate';
    extractedAmount?: number;
    extractedMerchant?: string;
    errorMessage?: string;
    processingMethod: 'filter' | 'rule_based' | 'gpt';
    confidence?: number;
    reason?: string; // Why was it terminated/failed
}

export class EmailProcessingLogService {
    constructor(private pool: Pool) { }

    /**
     * Log when an email is terminated (filtered out as non-transaction)
     */
    async logTerminator(data: {
        userId: string;
        emailMessageId: string;
        fromAddress: string;
        subject: string;
        reason: string;
        confidence?: number;
    }): Promise<void> {
        try {
            await this.pool.query(
                `INSERT INTO email_processing_log 
         (user_id, email_message_id, from_email, subject, processing_status, 
          error_message, processing_method, confidence_score, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (email_message_id) 
         DO UPDATE SET 
           processing_status = EXCLUDED.processing_status,
           error_message = EXCLUDED.error_message,
           processing_method = EXCLUDED.processing_method,
           confidence_score = EXCLUDED.confidence_score,
           reason = EXCLUDED.reason,
           processed_at = NOW()`,
                [
                    data.userId,
                    data.emailMessageId,
                    data.fromAddress,
                    data.subject,
                    'filter_terminated', // Status
                    data.reason, // Keep logging reason in error_message for backward compatibility/visibility
                    'filter', // Processing method
                    data.confidence || 0, // Confidence score
                    data.reason // New reason column
                ]
            );

            logger.info(
                `[TERMINATOR_LOG] Email ${data.emailMessageId} from ${data.fromAddress} ` +
                `terminated: "${data.reason}"`
            );
        } catch (error) {
            logger.error(
                `[LOG_ERROR] Failed to log terminator for email ${data.emailMessageId}:`,
                error
            );
            // Don't throw - logging errors should not break the pipeline
        }
    }

    /**
     * Log successful rule-based extraction
     */
    async logSuccess(data: {
        userId: string;
        emailMessageId: string;
        fromAddress: string;
        subject: string;
        extractedAmount: number;
        extractedMerchant: string;
        processingMethod: 'rule_based' | 'gpt';
    }): Promise<void> {
        try {
            await this.pool.query(
                `INSERT INTO email_processing_log 
         (user_id, email_message_id, from_email, subject, processing_status, 
          extracted_amount, extracted_merchant, processing_method, confidence_score, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (email_message_id)
         DO UPDATE SET
           processing_status = EXCLUDED.processing_status,
           extracted_amount = EXCLUDED.extracted_amount,
           extracted_merchant = EXCLUDED.extracted_merchant,
           processing_method = EXCLUDED.processing_method,
           confidence_score = EXCLUDED.confidence_score,
           processed_at = NOW()`,
                [
                    data.userId,
                    data.emailMessageId,
                    data.fromAddress,
                    data.subject,
                    `${data.processingMethod}_success`,
                    data.extractedAmount,
                    data.extractedMerchant,
                    data.processingMethod,
                    100, // Full confidence for successful extractions
                ]
            );

            logger.info(
                `[${data.processingMethod.toUpperCase()}_SUCCESS] Email ${data.emailMessageId} → ` +
                `${data.extractedMerchant} (₹${data.extractedAmount})`
            );
        } catch (error) {
            logger.error(
                `[LOG_ERROR] Failed to log success for email ${data.emailMessageId}:`,
                error
            );
        }
    }

    /**
     * Log when email is queued for GPT processing
     */
    async logQueuedForGpt(data: {
        userId: string;
        emailMessageId: string;
        fromAddress: string;
        subject: string;
        reason: string;
        partialData?: any;
    }): Promise<void> {
        try {
            await this.pool.query(
                `INSERT INTO email_processing_log 
         (user_id, email_message_id, from_email, subject, processing_status, 
          error_message, processing_method, metadata, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (email_message_id)
         DO UPDATE SET
            processing_status = EXCLUDED.processing_status,
            error_message = EXCLUDED.error_message,
            processing_method = EXCLUDED.processing_method,
            metadata = EXCLUDED.metadata,
            processed_at = NOW()`,
                [
                    data.userId,
                    data.emailMessageId,
                    data.fromAddress,
                    data.subject,
                    'rule_based_failed', // Status
                    data.reason,
                    'rule_based', // Processing method (about to try GPT)
                    JSON.stringify({ partialData: data.partialData }), // Metadata column
                ]
            );

            logger.info(
                `[QUEUED_FOR_GPT] Email ${data.emailMessageId} failed rule-based: "${data.reason}"`
            );
        } catch (error) {
            logger.error(
                `[LOG_ERROR] Failed to log GPT queue for email ${data.emailMessageId}:`,
                error
            );
        }
    }

    /**
     * Log when email processing encounters an error
     */
    async logError(data: {
        userId: string;
        emailMessageId: string;
        fromAddress: string;
        subject: string;
        errorMessage: string;
        stackTrace?: string;
    }): Promise<void> {
        try {
            await this.pool.query(
                `INSERT INTO email_processing_log 
         (user_id, email_message_id, from_email, subject, processing_status, 
          error_message, metadata, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (email_message_id) 
         DO UPDATE SET
            processing_status = EXCLUDED.processing_status,
            error_message = EXCLUDED.error_message,
            metadata = EXCLUDED.metadata,
            processed_at = NOW()`,
                [
                    data.userId,
                    data.emailMessageId,
                    data.fromAddress,
                    data.subject,
                    'invalid', // Generic error status
                    data.errorMessage,
                    JSON.stringify({ stackTrace: data.stackTrace }),
                ]
            );

            logger.error(
                `[PROCESSING_ERROR] Email ${data.emailMessageId}: ${data.errorMessage}`
            );
        } catch (error) {
            logger.error(
                `[LOG_ERROR] Failed to log error for email ${data.emailMessageId}:`,
                error
            );
        }
    }

    /**
     * Generate terminator report (daily/weekly)
     * Shows which emails were discarded and why
     */
    async getTerminatorReport(
        userId: string,
        startDate: Date,
        endDate: Date
    ): Promise<{
        totalTerminated: number;
        byReason: Record<string, number>;
        emails: Array<{
            emailMessageId: string;
            reason: string;
            timestamp: Date;
        }>;
    }> {
        try {
            const result = await this.pool.query(
                `SELECT error_message as reason, COUNT(*) as count, 
                ARRAY_AGG(email_message_id) as email_ids,
                ARRAY_AGG(processed_at) as timestamps
         FROM email_processing_log 
         WHERE user_id = $1 
           AND processing_status = 'filter_terminated'
           AND processed_at >= $2 
           AND processed_at <= $3
         GROUP BY error_message
         ORDER BY count DESC`,
                [userId, startDate, endDate]
            );

            const byReason: Record<string, number> = {};
            const emails: Array<{
                emailMessageId: string;
                reason: string;
                timestamp: Date;
            }> = [];

            let totalTerminated = 0;

            for (const row of result.rows) {
                byReason[row.reason] = row.count;
                totalTerminated += parseInt(row.count);

                for (let i = 0; i < row.email_ids.length; i++) {
                    emails.push({
                        emailMessageId: row.email_ids[i],
                        reason: row.reason,
                        timestamp: row.timestamps[i],
                    });
                }
            }

            return {
                totalTerminated,
                byReason,
                emails: emails.slice(0, 100), // Limit to 100 for readability
            };
        } catch (error) {
            logger.error(`[REPORT_ERROR] Failed to generate terminator report:`, error);
            throw error;
        }
    }
}
