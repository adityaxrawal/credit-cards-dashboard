import pool from '../../lib/db';
import logger from '../../utils/logger';

export type TerminationStage =
    | 'broad_filter'
    | 'evaluator'
    | 'rule_processing'
    | 'pipeline'
    | 'gpt'      // For GPT fallback/review path
    | 'pdf_processing'; // For statement PDFs if we ever terminate there

export type TerminationCategory =
    | 'NON_FINANCIAL'
    | 'LOW_CONFIDENCE'
    | 'HARD_NEGATIVE'
    | 'DUPLICATE'
    | 'SYSTEM_GUARD'
    | 'INVALID_AMOUNT'
    | 'UNKNOWN'
    | 'TRANSACTION' // Used for success/positive cases if we reuse this log
    | 'STATEMENT';  // Used for statement success

export class TerminatorService {
    /**
     * Terminate an email processing workflow.
     * Logs the termination reason and stage.
     * Idempotent: Updates existing record if found.
     */
    static async terminate(
        userId: string,
        emailId: string,
        reason: string,
        stage: TerminationStage,
        category: TerminationCategory = 'UNKNOWN',
        scanJobId?: string
    ) {
        try {
            await pool.query(
                `INSERT INTO email_processing_log (
                    user_id, 
                    email_message_id, 
                    processing_status, 
                    reason, 
                    stage, 
                    status_category, 
                    scan_job_id, 
                    created_at
                )
                 VALUES ($1, $2, 'terminated', $3, $4, $5, $6, NOW())
                 ON CONFLICT (email_message_id) DO UPDATE SET 
                    processing_status = 'terminated',
                    reason = EXCLUDED.reason,
                    stage = EXCLUDED.stage,
                    status_category = EXCLUDED.status_category,
                    scan_job_id = COALESCE(EXCLUDED.scan_job_id, email_processing_log.scan_job_id),
                    created_at = NOW()`, // Update timestamp on re-termination
                [userId, emailId, reason, stage, category, scanJobId || null]
            );

            // Optional: Log at debug level to avoid spamming console
            // logger.debug(`[Terminator] ${emailId} terminated at ${stage} (${category}): ${reason}`);

        } catch (error) {
            logger.error(`[Terminator] Failed to log termination for ${emailId}`, error);
            // We do not throw here to avoid crashing the pipeline just because logging failed,
            // but in a critical system we might want to ensure audit trails.
        }
    }

    /**
     * Get termination report.
     */
    static async getReport(userId: string, from: Date, to: Date) {
        const { rows } = await pool.query(
            `SELECT * FROM email_processing_log 
           WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
           ORDER BY created_at DESC`,
            [userId, from, to]
        );
        return rows;
    }
}
