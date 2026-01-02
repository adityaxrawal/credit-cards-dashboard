import cron from 'node-cron';
import { LogRepository } from '../../repositories/LogRepository';
import logger from '@shared/utils/infrastructure/logger';

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
        const now = new Date();
        const retentionDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

        // 1. Email Processing Logs
        const emailLogCount = await LogRepository.deleteOldEmailLogs(retentionDate);
        if (emailLogCount > 0) {
            logger.info(`[CleanupService] Deleted ${emailLogCount} old email_processing_log entries`);
        }

        // 2. Gmail Sync Jobs (Only completed/failed)
        const jobCount = await LogRepository.deleteOldSyncJobs(retentionDate);
        if (jobCount > 0) {
            logger.info(`[CleanupService] Deleted ${jobCount} old gmail_sync_jobs entries`);
        }

        // 3. Processing Retry Queue (Only completed/resolved)
        const queueCount = await LogRepository.deleteOldRetryItems(retentionDate);
        if (queueCount > 0) {
            logger.info(`[CleanupService] Deleted ${queueCount} old processing_retry_queue entries`);
        }

        // 4. Pipeline Error Logs
        const errorCount = await LogRepository.deleteOldPipelineErrors(retentionDate);
        if (errorCount > 0) {
            logger.info(`[CleanupService] Deleted ${errorCount} old pipeline_error_logs entries`);
        }
    }
}
