import logger from '../../utils/infrastructure/logger';
import { universalPipeline } from '../transactions/pipeline/UniversalTransactionPipeline';
import { SimplifiedEmail } from '../../types/transaction.types';

export class ExtractionService {
    async processCsv(userId: string, csvRows: any[]) {
        if (!Array.isArray(csvRows) || csvRows.length === 0) {
            throw new Error('Invalid or empty csvRows');
        }

        const result = {
            autoSave: [] as any[],
            needsReview: [] as any[],
            terminated: [] as any[],
            stats: { total: csvRows.length, saved: 0, review: 0, terminated: 0 }
        };

        const batchSize = 100;
        logger.info(`\nStarting Parallel CSV Extraction (Concurrency: ${batchSize}, Total Rows: ${csvRows.length})`);
        const startTime = Date.now();

        for (let i = 0; i < csvRows.length; i += batchSize) {
            const batch = csvRows.slice(i, i + batchSize);
            const batchStartTime = Date.now();
            logger.info(`\n[CSV BATCH] Processing rows ${i + 1} to ${Math.min(i + batchSize, csvRows.length)}`);

            await Promise.all(batch.map(async (row) => {
                try {
                    // Normalize typical input formats
                    const subject = row.subject || '';
                    const sender = row.sender || row.from || '';
                    const snippet = row.snippet || '';
                    const messageId = row.message_id || row.id || `csv_${Date.now()}_${Math.random()}`;
                    const internalDate = row.internal_date ? parseInt(row.internal_date) : Date.now();
                    const fullContent = row.cleaned_text || row.bodyText || row.body || '';

                    // Construct mock email for Pipeline
                    const mockEmail: SimplifiedEmail = {
                        messageId,
                        threadId: row.threadId || `csv_thread_${messageId}`,
                        from: sender,
                        to: row.to || 'user@example.com',
                        subject,
                        body: fullContent || snippet,
                        internalDate,
                        snippet
                    };

                    const fetchAttachment = async (msgId: string, attId: string) => Buffer.from('');

                    const pipelineResult = await universalPipeline.processEmail(
                        userId,
                        mockEmail,
                        `csv_job_${Date.now()}`,
                        fetchAttachment
                    );

                    if (pipelineResult.status === 'success' || pipelineResult.status === 'duplicate') {
                        result.autoSave.push(pipelineResult);
                        result.stats.saved++;
                    } else if (pipelineResult.status === 'needs_review') {
                        result.needsReview.push(pipelineResult);
                        result.stats.review++;
                    } else {
                        result.terminated.push({
                            emailId: messageId,
                            reason: (pipelineResult as any).reason || pipelineResult.status
                        });
                        result.stats.terminated++;
                    }

                } catch (error) {
                    result.terminated.push({
                        emailId: row.message_id || 'unknown',
                        reason: `Error: ${error instanceof Error ? error.message : String(error)}`
                    });
                    result.stats.terminated++;
                }
            }));

            const batchDuration = Date.now() - batchStartTime;
            logger.info(`[CSV BATCH END] Finished batch in ${batchDuration}ms`);
        }

        const totalDuration = Date.now() - startTime;
        logger.info(`\n[CSV EXTRACTION COMPLETE] Processed ${csvRows.length} rows in ${totalDuration}ms`);

        return {
            success: true,
            stats: result.stats,
            saved: result.autoSave.length,
            queued: result.needsReview.length,
            terminated: result.terminated.length,
        };
    }
}

export const extractionService = new ExtractionService();
