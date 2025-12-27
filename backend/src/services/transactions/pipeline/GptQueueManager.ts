import { CleanEmail, SimplifiedEmail } from '../../../types/transaction.types';
import logger from '../../../utils/infrastructure/logger';
import { universalPipeline } from './UniversalTransactionPipeline';
import pool from '../../../lib/db';

interface GptJob {
    userId: string;
    cleanEmail: CleanEmail;
    rawEmail: SimplifiedEmail;
    jobId: string;
    rawEmailId: string;
    // Callback to persist the result back to the main flow or DB
    onComplete?: () => void;
}

export class GptQueueManager {
    private mainQueue: GptJob[] = [];
    private subQueues: GptJob[][] = [[], [], []]; // 3 Sub-queues
    private isRunning = false;
    private activeWorkers: number[] = [0, 0, 0]; // Active workers per sub-queue

    // Config
    private SUB_QUEUE_COUNT = 3;
    private CONCURRENCY_PER_QUEUE = 4; // 12 total workers with 48 connection pool

    // State for stats
    public stats = {
        queued: 0,
        processed: 0,
        success: 0,
        failed: 0,
        nonFinancial: 0
    };

    constructor() { }

    /**
     * Add a job to the main queue
     */
    public enqueue(job: GptJob) {
        this.mainQueue.push(job);
        this.stats.queued++;
        // If system is started, ensure distributor is running
        this.kickstart();
    }

    /**
     * Start the processing pipeline
     */
    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.distributorLoop();

        // Start workers for each sub-queue
        for (let i = 0; i < this.SUB_QUEUE_COUNT; i++) {
            this.workerLoop(i);
        }
    }

    /**
     * Stop accepting new jobs and wait for current ones (graceful-ish)
     */
    public stop() {
        this.isRunning = false;
    }

    /**
     * Wait until all queues are empty and all workers are idle
     */
    public async drain() {
        // Wait until main queue is empty, sub queues are empty, and active workers are 0
        while (
            this.mainQueue.length > 0 ||
            this.subQueues.some(q => q.length > 0) ||
            this.activeWorkers.some(c => c > 0)
        ) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    // --- INTERNALS ---

    private kickstart() {
        if (!this.isRunning) {
            this.start();
        }
    }

    /**
     * Distributes jobs from Main Queue to Sub-Queues
     * "Distribute emails into three sub-queues"
     */
    private async distributorLoop() {
        while (this.isRunning || this.mainQueue.length > 0) {
            if (this.mainQueue.length === 0) {
                await new Promise(r => setTimeout(r, 50));
                continue;
            }

            const job = this.mainQueue.shift();
            if (!job) continue;

            // Simple Round-Robin or Load Balancing? 
            // "concurrent batch processing... capacity 2"
            // We'll pick the queue with the least items to balance load
            let targetQueueIdx = 0;
            let minLen = this.subQueues[0].length;

            for (let i = 1; i < this.SUB_QUEUE_COUNT; i++) {
                if (this.subQueues[i].length < minLen) {
                    minLen = this.subQueues[i].length;
                    targetQueueIdx = i;
                }
            }

            this.subQueues[targetQueueIdx].push(job);
        }
    }

    /**
     * Worker loop for a specific sub-queue
     */
    private async workerLoop(queueIndex: number) {
        while (this.isRunning || this.subQueues[queueIndex].length > 0) {

            // Check concurrency limit
            if (this.activeWorkers[queueIndex] >= this.CONCURRENCY_PER_QUEUE) {
                await new Promise(r => setTimeout(r, 50));
                continue;
            }

            const job = this.subQueues[queueIndex].shift();
            if (!job) {
                // Wait for work
                await new Promise(r => setTimeout(r, 100));
                continue;
            }

            // Execute Job
            this.activeWorkers[queueIndex]++;
            this.processJob(job).finally(() => {
                this.activeWorkers[queueIndex]--;
                job.onComplete?.();
            });
        }
    }

    private async processJob(job: GptJob) {
        try {
            // We need to call a specific method on pipeline that forces GPT
            // Since `universalPipeline.processEmail` does the whole flow, we need to invoke
            // the Logic that happens AFTER classification fallback.

            // Actually, the cleanest way is to call a newly exposed "processGptFallback" on pipeline
            // OR reuse processEmail but with a flag.

            // Let's assume we add `processGptOnly` to universalPipeline
            const result = await universalPipeline.processGptOnly(
                job.userId,
                job.cleanEmail,
                job.jobId,
                job.rawEmailId
            );

            this.stats.processed++;

            if (result.status === 'success') this.stats.success++;
            else if (result.status === 'terminated' && result.reason === 'non_financial') this.stats.nonFinancial++;
            else this.stats.failed++;

        } catch (error) {
            logger.error(`[GPT Queue] Failed to process job ${job.cleanEmail.id}`, error);
            this.stats.failed++;
        }
    }
}
