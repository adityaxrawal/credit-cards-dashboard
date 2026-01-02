/**
 * Notification Queue Repository
 * Data access layer for queued notifications
 */

import { query } from '@shared/database/db';

export interface NotificationQueueItem {
    id: string;
    userId: string;
    type: string;
    payload: any;
    createdAt: Date;
    processedAt: Date | null;
    status: 'pending' | 'processed' | 'failed';
    retryCount: number;
}

export class NotificationQueueRepository {
    /**
     * Add a notification to the queue
     */
    static async addToQueue(
        userId: string,
        type: string,
        payload: any
    ): Promise<NotificationQueueItem> {
        const result = await query(
            `INSERT INTO notification_queue (user_id, type, payload)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [userId, type, payload]
        );
        return this.mapRowToItem(result.rows[0]);
    }

    /**
     * Get pending notifications for a specific user
     * Useful for checking if user has pending alerts when quiet hours end
     */
    static async getPendingForUser(userId: string): Promise<NotificationQueueItem[]> {
        const result = await query(
            `SELECT * FROM notification_queue 
             WHERE user_id = $1 AND status = 'pending'
             ORDER BY created_at ASC`,
            [userId]
        );
        return result.rows.map(this.mapRowToItem);
    }

    /**
     * Get all pending notifications that need processing
     * Optional limit to process in batches
     */
    static async getPendingNotifications(limit: number = 50): Promise<NotificationQueueItem[]> {
        const result = await query(
            `SELECT * FROM notification_queue 
             WHERE status = 'pending'
             ORDER BY created_at ASC
             LIMIT $1`,
            [limit]
        );
        return result.rows.map(this.mapRowToItem);
    }

    /**
     * Mark a notification as processed
     */
    static async markAsProcessed(id: string): Promise<void> {
        await query(
            `UPDATE notification_queue 
             SET status = 'processed', processed_at = NOW()
             WHERE id = $1`,
            [id]
        );
    }

    /**
     * Mark a notification as failed
     */
    static async markAsFailed(id: string): Promise<void> {
        await query(
            `UPDATE notification_queue 
             SET status = 'failed', retry_count = retry_count + 1
             WHERE id = $1`,
            [id]
        );
    }

    private static mapRowToItem(row: any): NotificationQueueItem {
        return {
            id: row.id,
            userId: row.user_id,
            type: row.type,
            payload: row.payload,
            createdAt: row.created_at,
            processedAt: row.processed_at,
            status: row.status,
            retryCount: row.retry_count
        };
    }
}
