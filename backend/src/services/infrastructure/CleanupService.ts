
import cron from 'node-cron';
import pool from '../../lib/db';
import logger from '../../utils/infrastructure/logger';

/**
 * Cleanup Service
 * Automatically removes old logs and data to prevent database bloat.
 */
export class CleanupService {
    /**
     * Start the cleanup cron job
     * Schedule: Daily at 00:00 (Midnight)
     */
    static startCleanupCron() {
        logger.info('[CleanupService] Initializing cleanup cron job (Schedule: 0 0 * * *)');

        cron.schedule('0 0 * * *', async () => {
            logger.info('[CleanupService] Starting daily log cleanup...');
            try {
                await this.cleanupOldLogs();
                logger.info('[CleanupService] Daily cleanup completed successfully.');
            } catch (error) {
                logger.error('[CleanupService] Error during daily cleanup:', error);
            }
        });
    }

    /**
     * Delete logs older than 30 days
     */
    private static async cleanupOldLogs() {
        const retentionDays = 30;

        // 1. Email Processing Logs
        const emailLogsRes = await pool.query(
            `DELETE FROM email_processing_log WHERE created_at < NOW() - INTERVAL '${retentionDays} days'`
        );
        if ((emailLogsRes.rowCount || 0) > 0) {
            logger.info(`[CleanupService] Deleted ${emailLogsRes.rowCount} old email_processing_log entries`);
        }

        // 2. Gmail Sync Jobs (Only completed/failed, keep active ones just in case)
        const jobsRes = await pool.query(
            `DELETE FROM gmail_sync_jobs 
       WHERE (status = 'COMPLETED' OR status = 'FAILED') 
       AND created_at < NOW() - INTERVAL '${retentionDays} days'`
        );
        if ((jobsRes.rowCount || 0) > 0) {
            logger.info(`[CleanupService] Deleted ${jobsRes.rowCount} old gmail_sync_jobs entries`);
        }

        // 3. Processing Retry Queue (Only completed/resolved items)
        // Assuming 'completed' or similar status. If status isn't clear, we might skip or check logic.
        // Based on schema: status VARCHAR(20) DEFAULT 'pending'
        const queueRes = await pool.query(
            `DELETE FROM processing_retry_queue 
         WHERE status != 'pending' 
         AND created_at < NOW() - INTERVAL '${retentionDays} days'`
        );
        if ((queueRes.rowCount || 0) > 0) {
            logger.info(`[CleanupService] Deleted ${queueRes.rowCount} old processing_retry_queue entries`);
        }

        // 4. Pipeline Error Logs
        const errorsRes = await pool.query(
            `DELETE FROM pipeline_error_logs 
         WHERE created_at < NOW() - INTERVAL '${retentionDays} days'`
        );
        if ((errorsRes.rowCount || 0) > 0) {
            logger.info(`[CleanupService] Deleted ${errorsRes.rowCount} old pipeline_error_logs entries`);
        }
    }
}
