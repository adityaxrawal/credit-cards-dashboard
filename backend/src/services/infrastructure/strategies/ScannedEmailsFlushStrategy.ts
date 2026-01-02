/**
 * ScannedEmailsFlushStrategy
 * 
 * Handles flushing scanned email records to the database.
 * Extracted from DbWriteQueueManager as part of Strategy Pattern refactoring.
 */

import { FlushStrategy } from './FlushStrategy';
import { DbWriteJob, DbWriteTable } from '../DbWriteQueueManager';
import { LogRepository } from '../../../repositories/LogRepository';
import logger from '../../../utils/infrastructure/logger';

export class ScannedEmailsFlushStrategy implements FlushStrategy {
    readonly table: DbWriteTable = 'scanned_emails';

    async flush(jobs: DbWriteJob[]): Promise<void> {
        if (jobs.length === 0) return;

        try {
            await LogRepository.batchInsertScannedEmails(jobs.map(j => j.data));
            logger.debug(`[DbWriteQueue:scanned_emails] Flushed ${jobs.length} items`);
        } catch (error) {
            throw error;
        }
    }
}
