/**
 * DbWriteQueueManager - High-performance, fault-tolerant DB write queue
 * 
 * Design:
 * - Independent queues for different write types (extensible via Strategy Pattern)
 * - Max batch size: 40 rows per bulk write (Supabase Free Tier safe)
 * - Flush on: size >= 40 OR timer expiry (250ms)
 * - Retry buffer with exponential backoff for failed batches
 * - Never blocks processing pipeline
 * 
 * Refactored: Issue #9 - Uses Strategy Pattern for table-specific flushing
 */

import logger from '../../utils/infrastructure/logger';
import { randomUUID } from 'crypto';
import { FlushStrategy, defaultStrategies } from './strategies';

// Queue types
export type DbWriteTable = 'scanned_emails' | 'transactions' | 'terminations' | 'job_stats' | 'scanned_email_updates' | 'processing_logs';

export interface DbWriteJob {
    id: string;
    table: DbWriteTable;
    data: Record<string, unknown>;
    timestamp: number;
    retryCount: number;
    onComplete?: () => void;
    onError?: (err: Error) => void;
}

export interface QueueStats {
    table: DbWriteTable;
    queued: number;
    flushed: number;
    retries: number;
    failed: number;
}

// Per-queue configuration
const QUEUE_CONFIG = {
    MAX_BATCH_SIZE: 40,
    FLUSH_INTERVAL_MS: 250,
    MAX_RETRIES: 3,
    RETRY_BASE_DELAY_MS: 1000,
};

class DbWriteQueue {
    private queue: DbWriteJob[] = [];
    private retryBuffer: DbWriteJob[] = [];
    private flushTimer: NodeJS.Timeout | null = null;
    private isProcessing = false;

    public stats = {
        queued: 0,
        flushed: 0,
        retries: 0,
        failed: 0,
    };

    constructor(
        public readonly table: DbWriteTable,
        private readonly flushFn: (jobs: DbWriteJob[]) => Promise<void>
    ) { }

    enqueue(job: DbWriteJob): void {
        this.queue.push(job);
        this.stats.queued++;
        this.scheduleFlush();
    }

    private scheduleFlush(): void {
        // Immediate flush if batch is full
        if (this.queue.length >= QUEUE_CONFIG.MAX_BATCH_SIZE) {
            this.flush();
            return;
        }

        // Schedule timer-based flush
        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => {
                this.flushTimer = null;
                this.flush();
            }, QUEUE_CONFIG.FLUSH_INTERVAL_MS);
        }
    }

    async flush(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        // Take batch
        const batch = this.queue.splice(0, QUEUE_CONFIG.MAX_BATCH_SIZE);

        try {
            await this.flushFn(batch);
            this.stats.flushed += batch.length;

            // Call success callbacks
            batch.forEach(job => job.onComplete?.());

        } catch (error) {
            logger.error(`[DbWriteQueue:${this.table}] Flush failed for ${batch.length} items`, error);

            // Move to retry buffer
            for (const job of batch) {
                if (job.retryCount < QUEUE_CONFIG.MAX_RETRIES) {
                    job.retryCount++;
                    this.retryBuffer.push(job);
                    this.stats.retries++;
                } else {
                    this.stats.failed++;
                    job.onError?.(error instanceof Error ? error : new Error(String(error)));
                }
            }

            // Schedule retry with exponential backoff
            this.scheduleRetry();
        } finally {
            this.isProcessing = false;

            // Continue flushing if more items
            if (this.queue.length > 0) {
                this.scheduleFlush();
            }
        }
    }

    private scheduleRetry(): void {
        if (this.retryBuffer.length === 0) return;

        // Calculate delay based on max retry count in buffer
        const maxRetries = Math.max(...this.retryBuffer.map(j => j.retryCount));
        const delay = QUEUE_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, maxRetries - 1);

        setTimeout(() => {
            // Move retry items back to main queue
            const toRetry = this.retryBuffer.splice(0, QUEUE_CONFIG.MAX_BATCH_SIZE);
            this.queue.push(...toRetry);
            this.scheduleFlush();
        }, delay);
    }

    getDepth(): number {
        return this.queue.length + this.retryBuffer.length;
    }

    async drain(): Promise<void> {
        while (this.queue.length > 0 || this.retryBuffer.length > 0 || this.isProcessing) {
            await this.flush();
            await new Promise(r => setTimeout(r, 100));
        }
    }
}

/**
 * Main Queue Manager - Singleton
 * 
 * Uses Strategy Pattern for table-specific flush implementations.
 * Strategies are injected via constructor, enabling:
 * - Open/Closed Principle: Add new tables without modifying this class
 * - Testability: Mock strategies for unit testing queue mechanics
 * - Low coupling: Queue infrastructure decoupled from data models
 */
export class DbWriteQueueManager {
    private queues: Map<DbWriteTable, DbWriteQueue> = new Map();
    private strategies: Map<DbWriteTable, FlushStrategy> = new Map();
    private static instance: DbWriteQueueManager;

    private constructor(strategies: FlushStrategy[] = defaultStrategies) {
        // Register all provided strategies
        strategies.forEach(s => this.registerStrategy(s));
    }

    /**
     * Register a flush strategy for a table
     * Creates the corresponding queue with the strategy's flush function
     */
    registerStrategy(strategy: FlushStrategy): void {
        this.strategies.set(strategy.table, strategy);
        this.queues.set(strategy.table, new DbWriteQueue(
            strategy.table,
            strategy.flush.bind(strategy)
        ));
    }

    static getInstance(): DbWriteQueueManager {
        if (!DbWriteQueueManager.instance) {
            DbWriteQueueManager.instance = new DbWriteQueueManager();
        }
        return DbWriteQueueManager.instance;
    }

    /**
     * Create a new instance with custom strategies (for testing)
     */
    static createWithStrategies(strategies: FlushStrategy[]): DbWriteQueueManager {
        return new DbWriteQueueManager(strategies);
    }

    /**
     * Enqueue a write job - returns immediately, never blocks
     */
    enqueue(table: DbWriteTable, data: Record<string, unknown>, callbacks?: { onComplete?: () => void; onError?: (err: Error) => void }): string {
        const queue = this.queues.get(table);
        if (!queue) {
            throw new Error(`Unknown table: ${table}. No strategy registered.`);
        }

        const jobId = randomUUID();
        queue.enqueue({
            id: jobId,
            table,
            data,
            timestamp: Date.now(),
            retryCount: 0,
            onComplete: callbacks?.onComplete,
            onError: callbacks?.onError,
        });

        return jobId;
    }

    /**
     * Force flush a specific queue
     */
    async flush(table: DbWriteTable): Promise<void> {
        const queue = this.queues.get(table);
        if (queue) {
            await queue.flush();
        }
    }

    /**
     * Flush all queues (respects FK dependency order)
     */
    async flushAll(): Promise<void> {
        // Flush parent first
        const scannedEmailsQueue = this.queues.get('scanned_emails');
        if (scannedEmailsQueue) {
            await scannedEmailsQueue.flush();
        }

        // Then flush dependents in parallel
        const dependentQueues: DbWriteTable[] = ['transactions', 'processing_logs', 'terminations', 'scanned_email_updates', 'job_stats'];
        await Promise.all(
            dependentQueues
                .map(name => this.queues.get(name))
                .filter((q): q is DbWriteQueue => q !== undefined)
                .map(q => q.flush())
        );
    }

    /**
     * Wait for all queues to drain
     * NOTE: Drains in FK dependency order to prevent constraint violations:
     * - Phase 1: scanned_emails (parent table)
     * - Phase 2: All dependent tables in parallel (transactions, processing_logs, terminations, etc.)
     */
    async drain(): Promise<void> {
        // Phase 1: Drain parent tables first (scanned_emails must commit before children)
        const scannedEmailsQueue = this.queues.get('scanned_emails');
        if (scannedEmailsQueue) {
            await scannedEmailsQueue.drain();
        }

        // Phase 2: Drain dependent queues in parallel
        const dependentQueues: DbWriteTable[] = ['transactions', 'processing_logs', 'terminations', 'scanned_email_updates', 'job_stats'];
        await Promise.all(
            dependentQueues
                .map(name => this.queues.get(name))
                .filter((q): q is DbWriteQueue => q !== undefined)
                .map(q => q.drain())
        );
    }

    /**
     * Get queue depths for monitoring/WebSocket
     */
    getQueueDepths(): Record<DbWriteTable, number> {
        const depths: Partial<Record<DbWriteTable, number>> = {};
        Array.from(this.queues.entries()).forEach(([table, queue]) => {
            depths[table] = queue.getDepth();
        });
        return depths as Record<DbWriteTable, number>;
    }

    /**
     * Get stats for all queues
     */
    getStats(): QueueStats[] {
        return Array.from(this.queues.entries()).map(([table, queue]) => ({
            table,
            ...queue.stats,
        }));
    }

    /**
     * Get registered strategies (for debugging/introspection)
     */
    getRegisteredTables(): DbWriteTable[] {
        return Array.from(this.strategies.keys());
    }
}

// Export singleton instance
export const dbWriteQueueManager = DbWriteQueueManager.getInstance();
