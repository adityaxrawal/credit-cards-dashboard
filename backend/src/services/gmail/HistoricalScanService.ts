import { randomUUID } from 'crypto';
import logger from '../../utils/infrastructure/logger';
import { runHistoricalScan } from '../../jobs/historicalScanner';
import { JobRepository } from '../../repositories/JobRepository';

export interface ScanJob {
    jobId: string;
    status: string;
    currentStep: string;
    total: number;
    fetched: number;
    progress: number;
    processed: number;
    inserted: number;
    errors: number;
    errorList: any;
    startedAt: Date;
    completedAt: Date | null;
    lastUpdateAt: Date | null;
}

export class HistoricalScanService {
    /**
     * Trigger a historical scan job
     */
    static async triggerScan(userId: string, fromDate?: Date, toDate?: Date) {
        console.log(`[HistoricalScanService] Triggering scan for user ${userId}`, { fromDate, toDate });

        // Check for existing active job
        const latestJob = await this.getLatestJob(userId);
        const activeStatuses = ['PENDING', 'PROCESSING', 'FETCHING', 'GPT_PROCESSING'];

        if (latestJob && activeStatuses.includes(latestJob.status)) {
            // Check for staleness (no updates for 30 minutes)
            const lastUpdate = latestJob.lastUpdateAt ? new Date(latestJob.lastUpdateAt) : new Date(latestJob.startedAt);
            const now = new Date();
            const diffMinutes = (now.getTime() - lastUpdate.getTime()) / 1000 / 60;

            if (diffMinutes < 30) {
                logger.info(`[HistoricalScanService] Scan already running for user ${userId}: ${latestJob.jobId}`);
                return {
                    jobId: latestJob.jobId,
                    status: latestJob.status,
                    fromDate,
                    toDate,
                    message: 'A scan is already in progress',
                    existingJob: latestJob
                };
            }

            // Job is stale, mark as failed
            logger.warn(`[HistoricalScanService] Found stale job ${latestJob.jobId}. Marking as FAILED.`);
            await JobRepository.failJob(latestJob.jobId, 'Job marked as stale/abandoned due to inactivity');
        }

        const jobId = randomUUID();

        // Create job record
        await JobRepository.createJob(userId, jobId);

        // Start scan asynchronously
        runHistoricalScan(userId, jobId, fromDate, toDate)
            .then(result => {
                logger.info(`[HistoricalScanService] Scan ${jobId} completed:`, result);
            })
            .catch(error => {
                logger.error(`[HistoricalScanService] Scan ${jobId} failed:`, error);
                JobRepository.failJob(jobId, error.message).catch(dbError => {
                    logger.error(`[HistoricalScanService] Failed to update job status:`, dbError);
                });
            });

        return {
            jobId,
            status: 'PENDING',
            fromDate,
            toDate,
        };
    }

    /**
     * Get status of a specific scan job
     */
    static async getScanStatus(userId: string, jobId: string) {
        const job = await JobRepository.getJobById(userId, jobId);

        if (!job) {
            throw new Error('Job not found');
        }

        return {
            jobId: job.id,
            status: job.status,
            currentStep: job.current_step,
            total: job.total_messages || 0,
            fetched: job.emails_fetched || 0,
            progress: job.progress || 0,
            processed: job.processed_count || 0,
            inserted: job.saved_count || 0,
            errors: job.error_count || 0,
            errorList: job.errors,
            startedAt: job.started_at,
            completedAt: job.completed_at,
            lastUpdateAt: job.last_update_at,
            currentBatch: job.metadata?.currentBatch,
            totalBatches: job.metadata?.totalBatches,
            breakdown: {
                rule_based_success: job.rule_based_success || 0,
                rule_based_failure: job.rule_based_failure || 0,
                queued_for_gpt: job.queued_for_gpt || 0,
                terminated: job.terminated_count || 0,
            }
        };
    }

    /**
     * Get the latest scan job for a user
     */
    static async getLatestJob(userId: string): Promise<ScanJob | null> {
        const job = await JobRepository.getLatestJob(userId);

        if (!job) {
            return null;
        }

        return {
            jobId: job.id,
            status: job.status,
            currentStep: job.current_step,
            total: job.total_messages || 0,
            fetched: job.emails_fetched || 0,
            progress: job.progress || 0,
            processed: job.processed_count || 0,
            inserted: job.saved_count || 0,
            errors: job.error_count || 0,
            errorList: job.errors,
            startedAt: job.started_at,
            completedAt: job.completed_at,
            lastUpdateAt: job.last_update_at,
        };
    }

    /**
     * Get last successful sync timestamp
     */
    static async getLastSuccessfulSync(userId: string): Promise<Date | null> {
        return await JobRepository.getLastSuccessfulSync(userId);
    }

    /**
     * Trigger incremental sync (only new emails since last sync)
     */
    static async triggerIncrementalSync(userId: string) {
        logger.info('[HistoricalScanService] Triggering incremental sync', { userId });

        const lastSync = await this.getLastSuccessfulSync(userId);

        if (!lastSync) {
            // No previous sync, trigger from last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return this.triggerScan(userId, thirtyDaysAgo);
        }

        return this.triggerScan(userId, new Date(lastSync));
    }
}
