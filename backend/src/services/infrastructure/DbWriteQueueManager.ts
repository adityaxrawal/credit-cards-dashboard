/**
 * DbWriteQueueManager - High-performance, fault-tolerant DB write queue
 * 
 * Design:
 * - 5 independent queues for different write types
 * - Max batch size: 40 rows per bulk write (Supabase Free Tier safe)
 * - Flush on: size >= 40 OR timer expiry (250ms)
 * - Retry buffer with exponential backoff for failed batches
 * - Never blocks processing pipeline
 */

import pool from '../../lib/db';
import logger from '../../utils/infrastructure/logger';
import { randomUUID } from 'crypto';
import { createTransactionsBulk } from '../../db/queries/transactions.queries';

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
 */
export class DbWriteQueueManager {
    private queues: Map<DbWriteTable, DbWriteQueue> = new Map();
    private static instance: DbWriteQueueManager;

    private constructor() {
        // Initialize queues with their flush functions
        this.queues.set('scanned_emails', new DbWriteQueue('scanned_emails', this.flushScannedEmails.bind(this)));
        this.queues.set('transactions', new DbWriteQueue('transactions', this.flushTransactions.bind(this)));
        this.queues.set('terminations', new DbWriteQueue('terminations', this.flushTerminations.bind(this)));
        this.queues.set('job_stats', new DbWriteQueue('job_stats', this.flushJobStats.bind(this)));
        this.queues.set('scanned_email_updates', new DbWriteQueue('scanned_email_updates', this.flushScannedEmailUpdates.bind(this)));
        this.queues.set('processing_logs', new DbWriteQueue('processing_logs', this.flushProcessingLogs.bind(this)));
    }

    static getInstance(): DbWriteQueueManager {
        if (!DbWriteQueueManager.instance) {
            DbWriteQueueManager.instance = new DbWriteQueueManager();
        }
        return DbWriteQueueManager.instance;
    }

    /**
     * Enqueue a write job - returns immediately, never blocks
     */
    enqueue(table: DbWriteTable, data: Record<string, unknown>, callbacks?: { onComplete?: () => void; onError?: (err: Error) => void }): string {
        const queue = this.queues.get(table);
        if (!queue) {
            throw new Error(`Unknown table: ${table}`);
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
     * Flush all queues
     */
    async flushAll(): Promise<void> {
        await Promise.all(Array.from(this.queues.values()).map(q => q.flush()));
    }

    /**
     * Wait for all queues to drain
     */
    async drain(): Promise<void> {
        await Promise.all(Array.from(this.queues.values()).map(q => q.drain()));
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

    // ========================================
    // FLUSH IMPLEMENTATIONS
    // ========================================

    private async flushScannedEmails(jobs: DbWriteJob[]): Promise<void> {
        if (jobs.length === 0) return;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const values: unknown[] = [];
            const placeholders: string[] = [];
            let paramIndex = 1;

            for (const job of jobs) {
                const d = job.data;
                placeholders.push(
                    `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, NOW())`
                );
                values.push(
                    d.id, // Explicit ID from client
                    d.userId,
                    d.messageId,
                    d.internalDate,
                    d.snippet || '',
                    d.jobId
                );
                paramIndex += 6;
            }

            await client.query(
                `INSERT INTO gmail_scanned_emails (id, user_id, message_id, internal_date, raw_snippet, scan_job_id, scanned_at)
         VALUES ${placeholders.join(', ')}
         ON CONFLICT(user_id, message_id) DO UPDATE SET scan_job_id = EXCLUDED.scan_job_id`,
                values
            );

            await client.query('COMMIT');
            logger.debug(`[DbWriteQueue:scanned_emails] Flushed ${jobs.length} items`);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    private async flushProcessingLogs(jobs: DbWriteJob[]): Promise<void> {
        if (jobs.length === 0) return;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const values: unknown[] = [];
            const placeholders: string[] = [];
            let paramIndex = 1;

            for (const job of jobs) {
                const d = job.data;
                placeholders.push(
                    `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, NOW())`
                );
                values.push(
                    d.userId,
                    d.emailMessageId,
                    d.reason,
                    d.stage,
                    d.statusCategory,
                    d.processingStatus,
                    d.scanJobId,
                    d.rawEmailId || null
                );
                paramIndex += 8;
            }

            await client.query(
                `INSERT INTO email_processing_log 
                 (user_id, email_message_id, reason, stage, status_category, 
                  processing_status, scan_job_id, raw_email_id, processed_at)
                 VALUES ${placeholders.join(', ')}
                 ON CONFLICT (email_message_id) DO UPDATE SET 
                    scan_job_id = EXCLUDED.scan_job_id,
                    reason = EXCLUDED.reason,
                    processed_at = NOW()`,
                values
            );

            await client.query('COMMIT');
            logger.debug(`[DbWriteQueue:processing_logs] Flushed ${jobs.length} items`);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }



    private async flushTransactions(jobs: DbWriteJob[]): Promise<void> {
        if (jobs.length === 0) return;

        try {
            // Map jobs to the expected format for createTransactionsBulk
            const transactionsData = jobs.map(job => {
                const d = job.data;
                // Ensure explicit casting/conversion where necessary
                return {
                    id: d.id as string,
                    userId: d.userId as string,
                    instrumentType: d.instrumentType as string | undefined,
                    instrumentId: d.instrumentId as string | undefined,
                    cardId: d.cardId as string | undefined,
                    transactionDate: new Date(d.transactionDate as string | number | Date),
                    merchant: d.merchant as string,
                    category: d.category as string,
                    amount: Number(d.amount),
                    transactionType: d.transactionType as string,
                    direction: d.direction as string | undefined,
                    counterpartyName: d.counterpartyName as string | undefined,
                    counterpartyIdentifier: d.counterpartyIdentifier as string | undefined,
                    referenceNumber: d.referenceNumber as string | undefined,
                    description: d.description as string | undefined,
                    billMonth: d.billMonth as number | undefined,
                    billYear: d.billYear as number | undefined,
                    emailMessageId: d.emailMessageId as string | undefined,
                    emailSubject: d.emailSubject as string | undefined,
                    emailSender: d.emailSender as string | undefined,
                    txnFingerprint: d.txnFingerprint as string | undefined,
                    isManuallyAdded: d.isManuallyAdded as boolean | undefined,
                    metadata: d.metadata as any,
                    exactTimestamp: d.exactTimestamp ? new Date(d.exactTimestamp as string | number | Date) : undefined,
                    gmailThreadId: d.gmailThreadId as string | undefined,
                    gmailAccountIndex: d.gmailAccountIndex as number | undefined,
                    currencyCode: d.currencyCode as string | undefined,
                    originalAmount: d.originalAmount as number | undefined,
                    transactionSubtype: d.transactionSubtype as string | undefined,
                    classificationMethod: d.classificationMethod as string | undefined,
                    confidenceScore: d.confidenceScore as number | undefined,
                    needsReview: d.needsReview as boolean | undefined,
                    reviewReason: d.reviewReason as string | undefined,
                    rawExtraction: d.rawExtraction as any,
                    scanJobId: d.scanJobId as string | undefined,
                    rawEmailId: d.rawEmailId as string | undefined,
                };
            });

            await createTransactionsBulk(transactionsData);

            logger.debug(`[DbWriteQueue:transactions] Flushed ${jobs.length} items via bulk insert`);
        } catch (error) {
            // Re-throw to trigger retry logic in base class
            throw error;
        }
    }

    private async flushTerminations(jobs: DbWriteJob[]): Promise<void> {
        if (jobs.length === 0) return;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const values: unknown[] = [];
            const placeholders: string[] = [];
            let paramIndex = 1;

            for (const job of jobs) {
                const d = job.data;
                placeholders.push(
                    `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, NOW())`
                );
                values.push(
                    d.userId,
                    d.emailId,
                    d.reason,
                    d.stage,
                    d.type,
                    d.scanJobId,
                    d.rawEmailId || null
                );
                paramIndex += 7;
            }

            await client.query(
                `INSERT INTO terminated_emails (user_id, email_id, reason, stage, type, scan_job_id, raw_email_id, created_at)
         VALUES ${placeholders.join(', ')}
         ON CONFLICT DO NOTHING`,
                values
            );

            await client.query('COMMIT');
            logger.debug(`[DbWriteQueue:terminations] Flushed ${jobs.length} items`);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    private async flushJobStats(jobs: DbWriteJob[]): Promise<void> {
        // Job stats are UPDATE operations, not INSERT
        // Take the latest update for each jobId and apply it
        const latestByJob = new Map<string, DbWriteJob>();
        for (const job of jobs) {
            latestByJob.set(job.data.jobId as string, job);
        }

        const jobs_arr = Array.from(latestByJob.values());
        for (const job of jobs_arr) {
            const d = job.data;
            try {
                await pool.query(
                    `UPDATE gmail_sync_jobs 
           SET total_messages = $1, 
               emails_fetched = $1,
               processed_count = $2,
               progress = $3,
               rule_based_success = $4, 
               rule_based_failure = $5,
               queued_for_gpt = $6,
               terminated_count = $7, 
               errors = $8::jsonb,
               last_update_at = NOW()
           WHERE id = $9`,
                    [
                        d.total,
                        d.processed,
                        d.progress,
                        d.success,
                        d.failed,
                        d.needsReview,
                        d.terminated,
                        JSON.stringify(d.errors || []),
                        d.jobId
                    ]
                );
            } catch (error) {
                logger.error(`[DbWriteQueue:job_stats] Failed to update job ${d.jobId}`, error);
            }
        }
        logger.debug(`[DbWriteQueue:job_stats] Flushed ${latestByJob.size} job updates`);
    }

    private async flushScannedEmailUpdates(jobs: DbWriteJob[]): Promise<void> {
        if (jobs.length === 0) return;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Group updates by userId for efficient batch updates
            const updatesByUser = new Map<string, Array<{ messageId: string; transactionId?: string }>>();

            for (const job of jobs) {
                const d = job.data;
                const userId = d.userId as string;
                if (!updatesByUser.has(userId)) {
                    updatesByUser.set(userId, []);
                }
                updatesByUser.get(userId)!.push({
                    messageId: d.messageId as string,
                    transactionId: d.transactionId as string | undefined,
                });
            }

            const entries = Array.from(updatesByUser.entries());
            for (const [userId, updates] of entries) {
                const messageIds = updates.map(u => u.messageId);
                await client.query(
                    `UPDATE gmail_scanned_emails 
           SET processed = true, processed_at = NOW()
           WHERE user_id = $1 AND message_id = ANY($2)`,
                    [userId, messageIds]
                );
            }

            await client.query('COMMIT');
            logger.debug(`[DbWriteQueue:scanned_email_updates] Flushed ${jobs.length} items`);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

// Export singleton instance
export const dbWriteQueueManager = DbWriteQueueManager.getInstance();
