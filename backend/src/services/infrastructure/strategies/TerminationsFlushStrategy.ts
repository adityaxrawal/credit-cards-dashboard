/**
 * TerminationsFlushStrategy
 * 
 * Handles flushing termination records to the database.
 * Extracted from DbWriteQueueManager as part of Strategy Pattern refactoring.
 */

import { FlushStrategy } from './FlushStrategy';
import { DbWriteJob, DbWriteTable } from '../DbWriteQueueManager';
import { LogRepository } from '../../../repositories/LogRepository';
import logger from '@shared/utils/infrastructure/logger';

export class TerminationsFlushStrategy implements FlushStrategy {
    readonly table: DbWriteTable = 'terminations';

    async flush(jobs: DbWriteJob[]): Promise<void> {
        if (jobs.length === 0) return;

        try {
            await LogRepository.batchInsertTerminations(jobs.map(j => j.data));
            logger.debug(`[DbWriteQueue:terminations] Flushed ${jobs.length} items`);
        } catch (error) {
            throw error;
        }
    }
}
