import { query } from '../lib/db';

export interface DeadLetterMessage {
    id: string;
    source: string;
    payload: any;
    error: string;
    status: 'PENDING' | 'RESOLVED' | 'IGNORED';
    created_at: Date;
}

export class DlqRepository {
    /**
     * Insert message into DLQ
     */
    static async create(source: string, payload: any, errorMsg: string): Promise<void> {
        await query(
            `INSERT INTO dead_letter_queue (source, payload, error, status, created_at)
             VALUES ($1, $2, $3, 'PENDING', NOW())`,
            [source, JSON.stringify(payload), errorMsg]
        );
    }

    /**
     * Get pending messages
     */
    static async getPending(limit: number = 50): Promise<DeadLetterMessage[]> {
        const res = await query(
            `SELECT * FROM dead_letter_queue WHERE status = 'PENDING' ORDER BY created_at DESC LIMIT $1`,
            [limit]
        );
        return res.rows;
    }

    /**
     * Mark message as resolved
     */
    static async markResolved(id: string): Promise<void> {
        await query(
            `UPDATE dead_letter_queue SET status = 'RESOLVED', updated_at = NOW() WHERE id = $1`,
            [id]
        );
    }
}
