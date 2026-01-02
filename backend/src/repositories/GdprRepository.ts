/**
 * GDPR Repository
 * Data access layer for GDPR data export and deletion
 */

import pool, { query } from '../lib/db';

export class GdprRepository {
    /**
     * Get user profile (excluding sensitive fields)
     */
    static async getUserProfile(userId: string): Promise<any> {
        const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
        if (result.rows[0]) {
            const user = { ...result.rows[0] };
            delete user.password_hash; // Security
            return user;
        }
        return null;
    }

    /**
     * Get all user transactions
     */
    static async getUserTransactions(userId: string): Promise<any[]> {
        const result = await query('SELECT * FROM transactions WHERE user_id = $1', [userId]);
        return result.rows;
    }

    /**
     * Delete all user data (transaction-safe)
     */
    static async deleteAllUserData(userId: string): Promise<boolean> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Delete dependent data in order (if CASCADE not set)
            await client.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM budget_envelopes WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM users WHERE id = $1', [userId]);

            await client.query('COMMIT');
            return true;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }
}
