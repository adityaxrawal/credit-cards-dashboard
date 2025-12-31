/**
 * ProcessingWorkerPool - Fixed-concurrency worker pool for email processing
 * 
 * Design:
 * - Uses semaphore pattern for exactly 50 concurrent workers
 * - Decouples concurrency from batch size
 * - Returns pure in-memory ProcessResult DTOs
 * - Never awaits DB operations directly
 */

import logger from '../../utils/infrastructure/logger';

// Simple semaphore implementation
class Semaphore {
    private permits: number;
    private waitQueue: Array<() => void> = [];

    constructor(permits: number) {
        this.permits = permits;
    }

    async acquire(): Promise<void> {
        if (this.permits > 0) {
            this.permits--;
            return;
        }

        return new Promise<void>((resolve) => {
            this.waitQueue.push(resolve);
        });
    }

    release(): void {
        const next = this.waitQueue.shift();
        if (next) {
            next();
        } else {
            this.permits++;
        }
    }

    getAvailable(): number {
        return this.permits;
    }

    getWaiting(): number {
        return this.waitQueue.length;
    }
}

export interface WorkerPoolConfig {
    concurrency: number;
    name?: string;
}

export interface WorkerPoolStats {
    activeWorkers: number;
    availablePermits: number;
    queuedJobs: number;
    totalProcessed: number;
    totalFailed: number;
}

export class ProcessingWorkerPool<TInput, TOutput> {
    private semaphore: Semaphore;
    private isRunning = false;
    private inputQueue: TInput[] = [];
    private stats = {
        totalProcessed: 0,
        totalFailed: 0,
    };
    private name: string;

    constructor(
        private config: WorkerPoolConfig,
        private processFn: (input: TInput) => Promise<TOutput>,
        private onComplete?: (input: TInput, output: TOutput) => void,
        private onError?: (input: TInput, error: Error) => void
    ) {
        this.semaphore = new Semaphore(config.concurrency);
        this.name = config.name || 'WorkerPool';
    }

    /**
     * Start the worker pool
     */
    start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        logger.info(`[${this.name}] Started with concurrency ${this.config.concurrency}`);
    }

    /**
     * Stop accepting new work
     */
    stop(): void {
        this.isRunning = false;
        logger.info(`[${this.name}] Stopped`);
    }

    /**
     * Submit work to the pool - returns immediately
     */
    submit(input: TInput): void {
        if (!this.isRunning) {
            this.start();
        }
        this.inputQueue.push(input);
        this.processNext();
    }

    /**
     * Submit multiple items
     */
    submitBatch(inputs: TInput[]): void {
        if (!this.isRunning) {
            this.start();
        }
        this.inputQueue.push(...inputs);
        // Kick off processing for all items
        for (let i = 0; i < Math.min(inputs.length, this.config.concurrency); i++) {
            this.processNext();
        }
    }

    /**
     * Process next item from queue
     */
    private async processNext(): Promise<void> {
        if (this.inputQueue.length === 0) return;

        // Acquire semaphore (may wait)
        await this.semaphore.acquire();

        // Double-check queue (may have been drained)
        const input = this.inputQueue.shift();
        if (!input) {
            this.semaphore.release();
            return;
        }

        // Process without blocking the caller
        this.executeWork(input).finally(() => {
            this.semaphore.release();
            // Try to process next item
            if (this.inputQueue.length > 0) {
                this.processNext();
            }
        });
    }

    private async executeWork(input: TInput): Promise<void> {
        try {
            const output = await this.processFn(input);
            this.stats.totalProcessed++;
            this.onComplete?.(input, output);
        } catch (error) {
            this.stats.totalFailed++;
            this.onError?.(input, error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Wait for all queued work to complete
     */
    async drain(): Promise<void> {
        while (this.inputQueue.length > 0 || this.semaphore.getAvailable() < this.config.concurrency) {
            await new Promise(r => setTimeout(r, 50));
        }
    }

    /**
     * Get current stats
     */
    getStats(): WorkerPoolStats {
        return {
            activeWorkers: this.config.concurrency - this.semaphore.getAvailable(),
            availablePermits: this.semaphore.getAvailable(),
            queuedJobs: this.inputQueue.length,
            ...this.stats,
        };
    }

    /**
     * Get queue depth for monitoring
     */
    getQueueDepth(): number {
        return this.inputQueue.length;
    }
}

/**
 * Pre-configured pool for email processing with 50 concurrency
 */
export function createEmailProcessingPool<TInput, TOutput>(
    processFn: (input: TInput) => Promise<TOutput>,
    onComplete?: (input: TInput, output: TOutput) => void,
    onError?: (input: TInput, error: Error) => void
): ProcessingWorkerPool<TInput, TOutput> {
    return new ProcessingWorkerPool(
        { concurrency: 50, name: 'EmailProcessingPool' },
        processFn,
        onComplete,
        onError
    );
}
