import { EventEmitter } from 'events';
import pool from '../lib/db';
import { ExtractionInput } from './extraction.service';

interface QueuedItem {
    email: ExtractionInput;
    workerId: number;
    userId: string;
}

export class GptQueueManager extends EventEmitter {
    private queues: { [key: number]: QueuedItem[] } = {
        1: [],
        2: [],
        3: []
    };

    private batchSize = 5;

    constructor() {
        super();
    }

    /**
     * Add an email to a specific queue
     */
    async enqueue(email: ExtractionInput, fromWorkerId: number, userId: string) {
        // Map worker to queue: 1->1, 2->2, 3->3, 4->1 (Round robin fallback)
        let queueId = fromWorkerId;
        if (queueId > 3) queueId = 1;

        this.queues[queueId].push({ email, workerId: fromWorkerId, userId });

        // Log to DB that it's queued
        try {
            await pool.query(
                `UPDATE email_processing_log 
         SET processing_status = 'gpt_processing', 
             queue_id = $1,
             updated_at = NOW()
         WHERE email_message_id = $2`,
                [queueId, email.id]
            );
        } catch (e) {
            console.warn(`[QueueManager] Failed to update log for ${email.id}`, e);
        }

        // Check if batch is ready
        if (this.queues[queueId].length >= this.batchSize) {
            this.emit('batch_ready', queueId);
        }
    }

    /**
     * Get a batch of emails from a queue
     */
    getBatch(queueId: number): QueuedItem[] | null {
        if (this.queues[queueId].length >= this.batchSize) {
            // Splice the first batchSize items
            return this.queues[queueId].splice(0, this.batchSize);
        }

        // If we want to support draining partial batches (e.g. at end of job), 
        // we might need a force/drain flag. For now, strict batch size.
        return null;
    }

    /**
     * Force get remaining items (for end of job)
     */
    drainQueue(queueId: number): QueuedItem[] {
        if (this.queues[queueId].length > 0) {
            return this.queues[queueId].splice(0, this.queues[queueId].length);
        }
        return [];
    }

    getQueueStats() {
        return {
            queue1: this.queues[1].length,
            queue2: this.queues[2].length,
            queue3: this.queues[3].length
        };
    }
}

export const gptQueueManager = new GptQueueManager();
