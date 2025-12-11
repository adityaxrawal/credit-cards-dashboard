
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export interface EmailBatchJob {
    batchId: string;
    userId: string;
    jobId: string; // The parent scan job ID
    emails: SimplifiedEmail[];
    priority: number; // For future use (e.g. manual triggers)
    retryCount: number;
    createdAt: Date;
}

export interface SimplifiedEmail {
    messageId: string;
    threadId: string;
    from: string;
    to: string;
    subject: string;
    body: string; // Cleaned visible text
    internalDate: number;
}

class BatchQueueService extends EventEmitter {
    private queue: EmailBatchJob[] = [];
    private processing: Map<string, EmailBatchJob> = new Map();

    constructor() {
        super();
    }

    /**
     * Add a batch to the queue
     */
    public async enqueue(userId: string, scanJobId: string, emails: SimplifiedEmail[]): Promise<string> {
        const batchId = randomUUID();

        const job: EmailBatchJob = {
            batchId,
            userId,
            jobId: scanJobId,
            emails,
            priority: 1,
            retryCount: 0,
            createdAt: new Date()
        };

        this.queue.push(job);
        console.log(`[BatchQueue] Enqueued batch ${batchId} with ${emails.length} emails. Queue size: ${this.queue.length}`);

        this.emit('enqueue', job);

        return batchId;
    }

    /**
     * Get next batch for processing (FIFO)
     */
    public async getNextBatch(): Promise<EmailBatchJob | null> {
        if (this.queue.length === 0) {
            return null;
        }

        const job = this.queue.shift();
        if (job) {
            this.processing.set(job.batchId, job);
        }

        return job || null;
    }

    /**
     * Mark batch as completed
     */
    public async completeBatch(batchId: string): Promise<void> {
        this.processing.delete(batchId);
        console.log(`[BatchQueue] Batch ${batchId} completed. Pending: ${this.queue.length}`);
    }

    /**
     * Mark batch as failed (re-queue?)
     */
    public async failBatch(batchId: string, error: Error): Promise<void> {
        const job = this.processing.get(batchId);
        if (job) {
            console.error(`[BatchQueue] Batch ${batchId} failed:`, error);

            if (job.retryCount < 3) {
                job.retryCount++;
                console.log(`[BatchQueue] Re-queueing batch ${batchId} (Attempt ${job.retryCount + 1}/4)`);
                // Add to front of queue for immediate retry
                this.queue.unshift(job);
            } else {
                console.error(`[BatchQueue] Batch ${batchId} failed permanently after 3 retries.`);
                // Here we might want to log this to a DLQ or DB table
            }

            this.processing.delete(batchId);
        }
    }

    public getStats() {
        return {
            queued: this.queue.length,
            processing: this.processing.size
        };
    }
}

// Singleton instance
export const batchQueue = new BatchQueueService();
