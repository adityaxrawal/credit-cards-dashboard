import { query } from '@shared/database/db';

export class JobRepository {
    /**
     * Update sync job statistics
     */
    static async updateStats(
        jobId: string,
        stats: {
            total: number,
            processed: number,
            progress: number,
            success: number,
            failed: number,
            needsReview: number,
            terminated: number,
            errors: any[]
        }
    ): Promise<void> {
        await query(
            `UPDATE gmail_sync_jobs 
             SET total_messages = $1, 
                 emails_fetched = $1,
                 processed_count = $2,
                 progress = $3,
                 rule_based_success = $4, 
                 rule_based_failure = $5,
                 queued_for_gpt = $6,
                 terminated_count = $7, 
                 errors = $8::jsonb,
                 last_update_at = NOW()
             WHERE id = $9`,
            [
                stats.total,
                stats.processed,
                stats.progress,
                stats.success,
                stats.failed,
                stats.needsReview,
                stats.terminated,
                JSON.stringify(stats.errors || []),
                jobId
            ]
        );
    }
    /**
     * Create a new sync job
     */
    static async createJob(userId: string, jobId: string): Promise<void> {
        await query(
            `INSERT INTO gmail_sync_jobs (id, user_id, status, current_step, started_at)
             VALUES ($1, $2, 'PENDING', 'INITIALIZING', NOW())`,
            [jobId, userId]
        );
    }

    /**
     * Mark job as failed
     */
    static async failJob(jobId: string, error: string): Promise<void> {
        await query(
            `UPDATE gmail_sync_jobs 
             SET status = 'FAILED', errors = $1, completed_at = NOW(), last_update_at = NOW()
             WHERE id = $2`,
            [JSON.stringify([{ error }]), jobId]
        );
    }

    /**
     * Get job by ID
     */
    static async getJobById(userId: string, jobId: string): Promise<any> {
        const result = await query(
            `SELECT id, status, current_step, total_messages, processed_count, saved_count, error_count, errors,
                    started_at, completed_at, last_update_at, metadata, emails_fetched, progress,
                    rule_based_success, rule_based_failure, queued_for_gpt, terminated_count
             FROM gmail_sync_jobs
             WHERE id = $1 AND user_id = $2`,
            [jobId, userId]
        );
        return result.rows[0];
    }

    /**
     * Get latest job for user
     */
    static async getLatestJob(userId: string): Promise<any> {
        const result = await query(
            `SELECT id, status, current_step, total_messages, processed_count, saved_count, error_count, errors,
                    started_at, completed_at, last_update_at, emails_fetched, progress
             FROM gmail_sync_jobs
             WHERE user_id = $1
             ORDER BY started_at DESC
             LIMIT 1`,
            [userId]
        );
        return result.rows[0];
    }

    /**
     * Get last successful sync timestamp
     */
    static async getLastSuccessfulSync(userId: string): Promise<Date | null> {
        const result = await query(
            `SELECT completed_at
             FROM gmail_sync_jobs
             WHERE user_id = $1 AND status = 'completed'
             ORDER BY completed_at DESC
             LIMIT 1`,
            [userId]
        );
        return result.rows.length > 0 ? result.rows[0].completed_at : null;
    }
}
