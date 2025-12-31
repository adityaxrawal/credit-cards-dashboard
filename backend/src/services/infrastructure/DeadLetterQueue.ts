
/**
 * Dead Letter Queue (DLQ)
 * Stores failed jobs/messages for manual review or later retry.
 */

import pool from '../../lib/db';

export interface DeadLetterMessage {
    id: string;
    source: string; // e.g. 'GMAIL_INGESTION', 'PDF_PARSER'
    payload: any;
    error: string;
    status: 'PENDING' | 'RESOLVED' | 'IGNORED';
    created_at: Date;
}

export class DeadLetterQueue {

    /**
     * Push a message to the DLQ
     */
    static async push(source: string, payload: any, error: any) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        await pool.query(
            `INSERT INTO dead_letter_queue (source, payload, error, status, created_at)
             VALUES ($1, $2, $3, 'PENDING', NOW())`,
            [source, JSON.stringify(payload), errorMsg]
        );
    }

    /**
     * Get pending messages for review
     */
    static async getPending(limit: number = 50) {
        const res = await pool.query(
            `SELECT * FROM dead_letter_queue WHERE status = 'PENDING' ORDER BY created_at DESC LIMIT $1`,
            [limit]
        );
        return res.rows;
    }

    /**
     * Mark message as resolved
     */
    static async resolve(id: string) {
        await pool.query(
            `UPDATE dead_letter_queue SET status = 'RESOLVED', updated_at = NOW() WHERE id = $1`,
            [id]
        );
    }
}
