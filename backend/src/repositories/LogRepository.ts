/**
 * Log Repository
 * Centralized data access for system logs (email processing, pipelines, errors)
 */

import { query } from '../lib/db';

export class LogRepository {
    /**
     * Get email processing stats
     */
    static async getProcessingStats(userId: string, startDate: Date): Promise<any> {
        const stats = await query(
            `SELECT 
                COUNT(*) as total_processed,
                SUM(CASE WHEN processing_status = 'terminated' THEN 1 ELSE 0 END) as terminated,
                COUNT(DISTINCT status_category) FILTER (WHERE processing_status = 'terminated') as termination_types,
                array_agg(DISTINCT status_category) FILTER (WHERE processing_status = 'terminated') as termination_categories
             FROM email_processing_log
             WHERE user_id = $1 AND processed_at >= $2`,
            [userId, startDate]
        );
        return stats.rows[0];
    }

    /**
     * Get classifier stats
     */
    static async getClassifierStats(userId: string, startDate: Date): Promise<any[]> {
        const result = await query(
            `SELECT 
                classification_method,
                COUNT(*) as total,
                AVG(CAST(confidence_score AS FLOAT)) as avg_confidence
             FROM email_processing_log
             WHERE user_id = $1 
               AND processed_at >= $2
               AND processing_status != 'terminated'
               AND classification_method IS NOT NULL
             GROUP BY classification_method
             ORDER BY total DESC`,
            [userId, startDate]
        );
        return result.rows;
    }

    /**
     * Get classifier accuracy (global or user specific if needed, but Monitor implies global usage context or user context. 
     * The monitor method passed 'period' but query used only start date. Assuming filtered by date.)
     */
    static async getClassifierAccuracy(startDate: Date): Promise<any[]> {
        const result = await query(
            `SELECT 
                classification_method,
                COUNT(*) as total,
                AVG(CAST(confidence_score AS FLOAT)) as avg_confidence,
                SUM(CASE WHEN processing_status = 'success' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as success_rate
             FROM email_processing_log
             WHERE processing_status IN ('success', 'failed')
               AND processed_at >= $1
               AND classification_method IS NOT NULL
             GROUP BY classification_method
             ORDER BY total DESC`,
            [startDate]
        );
        return result.rows;
    }

    /**
     * Get termination report
     */
    static async getTerminationReport(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
        const result = await query(
            `SELECT 
                status_category,
                COUNT(*) as count,
                array_agg(reason) as reasons
             FROM email_processing_log
             WHERE user_id = $1 
               AND processing_status = 'terminated'
               AND processed_at BETWEEN $2 AND $3
             GROUP BY status_category
             ORDER BY count DESC`,
            [userId, startDate, endDate]
        );
        return result.rows;
    }

    /**
     * Delete old email logs
     */
    static async deleteOldEmailLogs(retentionDate: Date): Promise<number> {
        const result = await query(
            `DELETE FROM email_processing_log WHERE created_at < $1`,
            [retentionDate]
        );
        return result.rowCount || 0;
    }

    /**
     * Delete old sync jobs
     */
    static async deleteOldSyncJobs(retentionDate: Date): Promise<number> {
        const result = await query(
            `DELETE FROM gmail_sync_jobs 
             WHERE (status = 'COMPLETED' OR status = 'FAILED') 
             AND created_at < $1`,
            [retentionDate]
        );
        return result.rowCount || 0;
    }

    /**
     * Delete old retry queue items
     */
    static async deleteOldRetryItems(retentionDate: Date): Promise<number> {
        const result = await query(
            `DELETE FROM processing_retry_queue 
             WHERE status != 'pending' 
             AND created_at < $1`,
            [retentionDate]
        );
        return result.rowCount || 0;
    }

    /**
     * Delete old pipeline errors
     */
    static async deleteOldPipelineErrors(retentionDate: Date): Promise<number> {
        const result = await query(
            `DELETE FROM pipeline_error_logs 
             WHERE created_at < $1`,
            [retentionDate]
        );
        return result.rowCount || 0;
    }
    /**
     * Batch insert scanned emails
     */
    static async batchInsertScannedEmails(emails: any[]): Promise<void> {
        if (emails.length === 0) return;

        const values: unknown[] = [];
        const placeholders: string[] = [];
        let paramIndex = 1;

        for (const email of emails) {
            placeholders.push(
                `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, NOW())`
            );
            values.push(
                email.id,
                email.userId,
                email.messageId,
                email.internalDate,
                email.snippet || '',
                email.jobId
            );
            paramIndex += 6;
        }

        await query(
            `INSERT INTO gmail_scanned_emails (id, user_id, message_id, internal_date, raw_snippet, scan_job_id, scanned_at)
             VALUES ${placeholders.join(', ')}
             ON CONFLICT(user_id, message_id) DO UPDATE SET scan_job_id = EXCLUDED.scan_job_id`,
            values
        );
    }

    /**
     * Batch insert processing logs
     */
    static async batchInsertProcessingLogs(logs: any[]): Promise<void> {
        if (logs.length === 0) return;

        const values: unknown[] = [];
        const placeholders: string[] = [];
        let paramIndex = 1;

        for (const log of logs) {
            placeholders.push(
                `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, NOW())`
            );
            values.push(
                log.userId,
                log.emailMessageId,
                log.reason,
                log.stage,
                log.statusCategory,
                log.processingStatus,
                log.scanJobId,
                log.rawEmailId || null
            );
            paramIndex += 8;
        }

        await query(
            `INSERT INTO email_processing_log 
             (user_id, email_message_id, reason, stage, status_category, 
              processing_status, scan_job_id, raw_email_id, processed_at)
             VALUES ${placeholders.join(', ')}
             ON CONFLICT (email_message_id) DO UPDATE SET 
                scan_job_id = EXCLUDED.scan_job_id,
                reason = EXCLUDED.reason,
                processed_at = NOW()`,
            values
        );
    }

    /**
     * Batch insert terminations
     */
    static async batchInsertTerminations(items: any[]): Promise<void> {
        if (items.length === 0) return;

        const values: unknown[] = [];
        const placeholders: string[] = [];
        let paramIndex = 1;

        for (const item of items) {
            placeholders.push(
                `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, NOW())`
            );
            values.push(
                item.userId,
                item.emailId,
                item.reason,
                item.stage,
                item.type,
                item.scanJobId,
                item.rawEmailId || null
            );
            paramIndex += 7;
        }

        await query(
            `INSERT INTO terminated_emails (user_id, email_id, reason, stage, type, scan_job_id, raw_email_id, created_at)
             VALUES ${placeholders.join(', ')}
             ON CONFLICT DO NOTHING`,
            values
        );
    }

    /**
     * Batch update scanned emails (mark as processed)
     * NOTE: This performs multiple updates, so we should consider how to handle it efficiently.
     * The original code grouped by user. We can do the same here or push logic to caller.
     * For now, let's accept grouped data or handle grouping.
     */
    static async batchMarkScannedEmailsProcessed(updates: { userId: string, messageIds: string[] }[]): Promise<void> {
        // This is tricky because it requires multiple queries (one per user).
        // `query` does not support transaction across calls unless we pass client.
        // We will execute them sequentially. It's fine for now, or we can use executeTransaction if imported.

        for (const update of updates) {
            await query(
                `UPDATE gmail_scanned_emails 
                 SET processed = true, processed_at = NOW()
                 WHERE user_id = $1 AND message_id = ANY($2)`,
                [update.userId, update.messageIds]
            );
        }
    }
}
