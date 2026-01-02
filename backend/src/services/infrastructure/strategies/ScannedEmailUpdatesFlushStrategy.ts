/**
 * ScannedEmailUpdatesFlushStrategy
 * 
 * Handles flushing scanned email update records (mark as processed).
 * Groups updates by userId for efficient batch processing.
 * Extracted from DbWriteQueueManager as part of Strategy Pattern refactoring.
 */

import { FlushStrategy } from './FlushStrategy';
import { DbWriteJob, DbWriteTable } from '../DbWriteQueueManager';
import { LogRepository } from '../../../repositories/LogRepository';
import logger from '@shared/utils/infrastructure/logger';

export class ScannedEmailUpdatesFlushStrategy implements FlushStrategy {
    readonly table: DbWriteTable = 'scanned_email_updates';

    async flush(jobs: DbWriteJob[]): Promise<void> {
        if (jobs.length === 0) return;

        try {
            // Group updates by userId for efficient batch updates
            const updatesByUser = new Map<string, string[]>();

            for (const job of jobs) {
                const d = job.data;
                const userId = d.userId as string;
                if (!updatesByUser.has(userId)) {
                    updatesByUser.set(userId, []);
                }
                updatesByUser.get(userId)!.push(d.messageId as string);
            }

            const updates = Array.from(updatesByUser.entries()).map(([userId, messageIds]) => ({
                userId,
                messageIds
            }));

            await LogRepository.batchMarkScannedEmailsProcessed(updates);

            logger.debug(`[DbWriteQueue:scanned_email_updates] Flushed ${jobs.length} items`);
        } catch (error) {
            throw error;
        }
    }
}
