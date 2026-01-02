import logger from '@shared/utils/infrastructure/logger';
import { DbWriteQueueManager } from '../DbWriteQueueManager';
import { LogRepository } from '../../../repositories/LogRepository';

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
        rawEmailId: string,
        markProcessed: boolean = true
    ): Promise<void> {
        try {
            // Use Queue Manager to handle writes asynchronously and with retries
            // This prevents FK race conditions vs scanned_emails insert which is also queued
            const queueManager = DbWriteQueueManager.getInstance();

            queueManager.enqueue('processing_logs', {
                userId,
                emailMessageId: emailId,
                reason,
                stage,
                statusCategory,
                processingStatus: 'terminated',
                scanJobId: jobId,
                rawEmailId
            });

            if (markProcessed) {
                queueManager.enqueue('scanned_email_updates', {
                    userId,
                    messageId: emailId // flushScannedEmailUpdates expects messageId to find by (user_id, message_id)
                });
            }

        } catch (error) {
            logger.error('Failed to log termination', error);
            // Swallow error to avoid crashing pipeline
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
        const rows = await LogRepository.getTerminationReport(userId, startDate, endDate);

        // Limit examples in JS
        const categories = rows.map(row => ({
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
