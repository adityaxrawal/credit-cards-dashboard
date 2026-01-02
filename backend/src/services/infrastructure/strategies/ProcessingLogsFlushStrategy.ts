/**
 * ProcessingLogsFlushStrategy
 * 
 * Handles flushing processing log records to the database.
 * Extracted from DbWriteQueueManager as part of Strategy Pattern refactoring.
 */

import { FlushStrategy } from './FlushStrategy';
import { DbWriteJob, DbWriteTable } from '../DbWriteQueueManager';
import { LogRepository } from '../../../repositories/LogRepository';
import logger from '@shared/utils/infrastructure/logger';

export class ProcessingLogsFlushStrategy implements FlushStrategy {
    readonly table: DbWriteTable = 'processing_logs';

    async flush(jobs: DbWriteJob[]): Promise<void> {
        if (jobs.length === 0) return;

        try {
            await LogRepository.batchInsertProcessingLogs(jobs.map(j => j.data));
            logger.debug(`[DbWriteQueue:processing_logs] Flushed ${jobs.length} items`);
        } catch (error) {
            throw error;
        }
    }
}
