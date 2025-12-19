import { EventEmitter } from 'events';

/**
 * GPT Processing Queue
 * 
 * DESIGN DECISIONS:
 * 1. Batch processing (5 items) to optimize API calls
 * 2. Max queue size to prevent unbounded growth
 * 3. Async flush with proper completion waiting
 * 4. Event-driven architecture for loose coupling
 */
export class GptQueue extends EventEmitter {
    private queue: any[] = [];
    private BATCH_SIZE = 5;
    private MAX_QUEUE_SIZE = 500; // Prevent unbounded growth
    private processingCount = 0;

    constructor() {
        super();
    }

    enqueue(item: any): boolean {
        // Reject if queue is full to provide backpressure
        if (this.queue.length >= this.MAX_QUEUE_SIZE) {
            console.warn(`[GptQueue] Queue full (${this.MAX_QUEUE_SIZE}), rejecting item`);
            return false;
        }

        this.queue.push(item);
        if (this.queue.length >= this.BATCH_SIZE) {
            this.emit('batch_ready', this.dequeueBatch());
        }
        return true;
    }

    dequeueBatch(): any[] {
        return this.queue.splice(0, this.BATCH_SIZE);
    }

    /**
     * Flush remaining items (sync version for backward compatibility)
     */
    flush() {
        while (this.queue.length > 0) {
            this.emit('batch_ready', this.dequeueBatch());
        }
    }

    /**
     * Flush and wait for all processing to complete.
     * @param timeoutMs Maximum time to wait for processing
     * @returns Promise that resolves when queue is empty and processing complete
     */
    async flushAsync(timeoutMs: number = 30000): Promise<{ flushed: number; remaining: number }> {
        const initialCount = this.queue.length;

        // Flush all items
        this.flush();

        // Wait for processing to complete with timeout
        const startTime = Date.now();
        while (this.queue.length > 0 || this.processingCount > 0) {
            if (Date.now() - startTime > timeoutMs) {
                console.warn(`[GptQueue] Flush timeout after ${timeoutMs}ms`);
                break;
            }
            await new Promise(r => setTimeout(r, 100));
        }

        return {
            flushed: initialCount - this.queue.length,
            remaining: this.queue.length
        };
    }

    /**
     * Track processing start/end for flush waiting
     */
    startProcessing(): void {
        this.processingCount++;
    }

    endProcessing(): void {
        this.processingCount = Math.max(0, this.processingCount - 1);
    }

    get length() {
        return this.queue.length;
    }

    get isProcessing() {
        return this.processingCount > 0;
    }

    get maxSize() {
        return this.MAX_QUEUE_SIZE;
    }
}

export const gptQueue = new GptQueue();

