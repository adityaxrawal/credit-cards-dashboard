import { ExtractionInput } from './extraction.service';
import { ruleBasedWorkerPool } from './ruleBasedWorkerPool';
import { gptQueueManager } from './gptQueueManager';
// Import gptBatchProcessor to ensure it's initialized and listening
import './gptBatchProcessor';

export class ParallelProcessingCoordinator {

    /**
     * Process a list of emails in parallel using the worker pool
     */
    async processEmails(emails: ExtractionInput[], userId: string, jobId: string) {
        console.log(`[Coordinator] Starting parallel processing for ${emails.length} emails...`);
        const startTime = Date.now();

        const results = await Promise.all(emails.map(async (email, index) => {
            // Round robin worker assignment
            const workerId = (index % 4) + 1;

            const result = await ruleBasedWorkerPool.processEmail(userId, email, workerId);

            if (result.status === 'success') return 'success';
            if (result.status === 'ignored' || result.status === 'already_processed' || result.status === 'duplicate') return 'ignored';

            // If failed, route to GPT queue
            if (result.queueId) {
                await gptQueueManager.enqueue(email, result.workerId, userId);
                return 'queued';
            }

            return 'unknown';
        }));

        const duration = Date.now() - startTime;
        console.log(`[Coordinator] Rule-based processing complete in ${duration}ms`);
        console.log(`[Coordinator] Queue Stats:`, gptQueueManager.getQueueStats());

        // Calculate stats from results
        const stats = {
            total: emails.length, // use total for historicalScanner
            success: 0,
            ignored: 0,
            queued: 0
        };

        for (const result of results) {
            switch (result) {
                case 'success':
                    stats.success++;
                    break;
                case 'ignored':
                    stats.ignored++;
                    break;
                case 'queued':
                    stats.queued++;
                    break;
                default:
                    break;
            }
        }

        // NOTE: GPT processing happens asynchronously via events in gptQueueManager + gptBatchProcessor
        // We don't wait for GPT to finish here, unless we want to block the job?
        // Historical scanner usually runs as a script. If we exit, the process dies.
        // So we might need a way to wait for queues to empty?

        return stats; // Return the calculated stats
    }
}

export const parallelProcessingCoordinator = new ParallelProcessingCoordinator();
