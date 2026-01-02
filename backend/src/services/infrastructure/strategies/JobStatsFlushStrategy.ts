/**
 * JobStatsFlushStrategy
 * 
 * Handles flushing job statistics updates to the database.
 * Includes deduplication logic - takes the latest update for each jobId.
 * Extracted from DbWriteQueueManager as part of Strategy Pattern refactoring.
 */

import { FlushStrategy } from './FlushStrategy';
import { DbWriteJob, DbWriteTable } from '../DbWriteQueueManager';
import { JobRepository } from '../../../repositories/JobRepository';
import logger from '@shared/utils/infrastructure/logger';

export class JobStatsFlushStrategy implements FlushStrategy {
    readonly table: DbWriteTable = 'job_stats';

    async flush(jobs: DbWriteJob[]): Promise<void> {
        // Job stats are UPDATE operations, not INSERT
        // Take the latest update for each jobId and apply it
        const latestByJob = new Map<string, DbWriteJob>();
        for (const job of jobs) {
            latestByJob.set(job.data.jobId as string, job);
        }

        const jobs_arr = Array.from(latestByJob.values());
        for (const job of jobs_arr) {
            const d = job.data;
            try {
                await JobRepository.updateStats(d.jobId as string, {
                    total: d.total as number,
                    processed: d.processed as number,
                    progress: d.progress as number,
                    success: d.success as number,
                    failed: d.failed as number,
                    needsReview: d.needsReview as number,
                    terminated: d.terminated as number,
                    errors: d.errors as any[]
                });
            } catch (error) {
                logger.error(`[DbWriteQueue:job_stats] Failed to update job ${d.jobId}`, error);
            }
        }
        logger.debug(`[DbWriteQueue:job_stats] Flushed ${latestByJob.size} job updates`);
    }
}
