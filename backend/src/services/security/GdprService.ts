
/**
 * GDPR Service
 * Handles data export and deletion requests.
 */

import pool from '../../lib/db';
import { ReportService } from '../reports/ReportService';

export class GdprService {

    /**
     * Export all user data as a JSON object
     */
    static async exportAllUserData(userId: string) {
        // 1. User Profile
        const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0];
        delete user.password_hash; // Security

        // 2. Transactions
        const txnsRes = await pool.query('SELECT * FROM transactions WHERE user_id = $1', [userId]);

        // 3. Budgets
        // ... (fetch other data)

        return {
            profile: user,
            transactions: txnsRes.rows,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Delete user account and all associated data
     * WARNING: Irreversible
     */
    static async deleteUserAccount(userId: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Delete dependent data in order (if CASCADE not set)
            // Ideally Schema uses ON DELETE CASCADE, but to be safe:

            // Delete transactions
            await client.query('DELETE FROM transactions WHERE user_id = $1', [userId]);

            // Delete budgets
            await client.query('DELETE FROM budget_envelopes WHERE user_id = $1', [userId]);

            // Delete user sessions
            await client.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);

            // Delete user
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
