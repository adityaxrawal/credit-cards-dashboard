import pool from '../../../lib/db';
import logger from '../../../utils/infrastructure/logger';

export class TerminatorService {
    /**
     * Log a terminated email processing attempt
     */
    static async terminate(
        userId: string,
        emailId: string,
        reason: string,
        stage: string,
        statusCategory: string,
        jobId: string,
        rawEmailId: string
    ): Promise<void> {
        try {
            await pool.query(
                `INSERT INTO email_processing_log 
         (user_id, email_message_id, reason, stage, status_category, 
          processing_status, scan_job_id, raw_email_id, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                [userId, emailId, reason, stage, statusCategory, 'terminated', jobId, rawEmailId]
            );

            // Also mark as processed in gmail_scanned_emails if terminated?
            // Guide says "processed_at" usually implies success, but for queue management
            // we might want to mark it so it doesn't get picked up again unless reprocessing.
            // But typically "Terminated" means done for this cycle.
            await pool.query(
                `UPDATE gmail_scanned_emails SET processed = true, processed_at = NOW() WHERE id = $1`,
                [rawEmailId]
            );

        } catch (error) {
            logger.error('Failed to log termination', error);
            // Swallow error to avoid crashing pipeline, but log it
        }
    }

    static async getReport(
        userId: string,
        startDate: Date,
        endDate: Date
    ): Promise<{
        period: { start: Date; end: Date };
        categories: Array<{ status_category: string; count: number; examples: string[] }>;
        totalTerminated: number;
    }> {
        const result = await pool.query(
            `SELECT 
        status_category,
        COUNT(*) as count,
        array_agg(reason) as reasons -- LIMIT in query usually not supported in agg, use subquery or JS slice
       FROM email_processing_log
       WHERE user_id = $1 
         AND processing_status = 'terminated'
         AND processed_at BETWEEN $2 AND $3
       GROUP BY status_category
       ORDER BY count DESC`,
            [userId, startDate, endDate]
        );

        // Limit examples in JS
        const categories = result.rows.map(row => ({
            status_category: row.status_category,
            count: parseInt(row.count, 10),
            examples: (row.reasons || []).slice(0, 5)
        }));

        return {
            period: { start: startDate, end: endDate },
            categories,
            totalTerminated: categories.reduce((s: number, r: any) => s + r.count, 0)
        };
    }
}
