import { ExtractionInput } from './extraction.service';
import { ruleBasedWorkerPool } from './ruleBasedWorkerPool';
import { gptQueueManager } from './gptQueueManager';
// Import gptBatchProcessor to ensure it's initialized and listening
import { gptProcessor } from './gptBatchProcessor';
import { broadcastProcessingUpdate } from './webSocketService';

export class ParallelProcessingCoordinator {

    /**
     * Process a list of emails in parallel using the worker pool
     */
    private activeJobs = new Map<string, {
        userId: string;
        startTime: number;
        totalEmails: number;
        processedCount: number;
        status: 'running' | 'completed' | 'failed' | 'timeout';
        timer: NodeJS.Timeout;
    }>();

    private JOB_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

    /**
     * Process a list of emails in parallel using the worker pool
     */
    async processEmails(emails: ExtractionInput[], userId: string, jobId: string) {
        console.log(`[Coordinator] Starting parallel processing for ${emails.length} emails...`);

        // Track job
        const timer = setTimeout(() => this.handleJobTimeout(jobId), this.JOB_TIMEOUT_MS);
        this.activeJobs.set(jobId, {
            userId,
            startTime: Date.now(),
            totalEmails: emails.length,
            processedCount: 0,
            status: 'running',
            timer
        });

        const startTime = Date.now();

        let completedCount = 0;
        let successCount = 0;
        let failedCount = 0;

        const results = await Promise.all(emails.map(async (email, index) => {
            // Round robin worker assignment based on available workers
            const workerId = (index % 4) + 1; // Assuming 4 workers

            // Check if job still running
            const job = this.activeJobs.get(jobId);
            if (!job || job.status !== 'running') return 'skipped';

            const result = await ruleBasedWorkerPool.processEmail(userId, email, workerId);

            completedCount++;

            let status = 'unknown';

            if (result.status === 'success') {
                status = 'success';
                successCount++;
            } else if (result.status === 'ignored' || result.status === 'already_processed' || result.status === 'duplicate') {
                status = 'ignored';
            } else if (result.queueId) {
                // If failed, route to GPT queue
                await gptQueueManager.enqueue(email, result.workerId, userId);
                status = 'queued';
                failedCount++; // Counting queued as failed/pending for now
            }

            // Emit progress update every 5 items or on completion
            if (completedCount % 5 === 0 || completedCount === emails.length) {
                const queueStats = gptQueueManager.getQueueStats();
                broadcastProcessingUpdate(jobId, {
                    totalProcessed: completedCount,
                    totalTransactions: successCount,
                    totalErrors: failedCount,
                    queueStatus: {
                        queue1: queueStats.queue1,
                        queue2: queueStats.queue2,
                        queue3: queueStats.queue3
                    }
                });
            }

            return status;
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

        // Drain queues before finishing
        if (stats.queued > 0) {
            console.log(`[Coordinator] Draining queues for ${stats.queued} items...`);
            await this.drainQueues();
        }

        // Mark job complete
        const job = this.activeJobs.get(jobId);
        if (job) {
            clearTimeout(job.timer);
            job.status = 'completed';
            this.activeJobs.delete(jobId);
        }

        return stats;
    }

    private async drainQueues() {
        console.log('[Coordinator] Starting queue drain...');
        // Drain each queue
        for (let qId = 1; qId <= 3; qId++) {
            const items = gptQueueManager.drainQueue(qId);
            if (items.length > 0) {
                console.log(`[Coordinator] Draining Queue ${qId} with ${items.length} items (forcing batch)`);
                // Use gptProcessor to force process
                // Explicitly call the public processBatch method we just added
                await gptProcessor.processBatch(items, qId);
            }
        }
    }

    private handleJobTimeout(jobId: string) {
        console.error(`[Coordinator] Job ${jobId} timed out after ${this.JOB_TIMEOUT_MS}ms`);
        const job = this.activeJobs.get(jobId);
        if (job) {
            job.status = 'timeout';
            // We can't easily cancel promises, but the checks inside loop will stop processing new ones if any were sequential.
            // But Promise.all is parallel.
            // We mainly use this to clean up memory.
            this.activeJobs.delete(jobId);
        }
    }
}

export const parallelProcessingCoordinator = new ParallelProcessingCoordinator();
