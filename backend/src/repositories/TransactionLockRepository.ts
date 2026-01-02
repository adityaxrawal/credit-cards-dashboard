/**
 * Transaction Lock Repository
 * Data access layer for transaction locking functionality
 */

import { query } from '../lib/db';

export class TransactionLockRepository {
    /**
     * Get user lock settings
     */
    static async getLockSettings(userId: string, defaultLockDays: number): Promise<any> {
        const result = await query(
            `SELECT 
                COALESCE((settings->>'transaction_lock_days')::int, $2) as lock_days,
                COALESCE((settings->>'transaction_lock_enabled')::boolean, true) as enabled,
                COALESCE((settings->>'transaction_lock_admin_override')::boolean, false) as allow_admin_override
             FROM users WHERE id = $1`,
            [userId, defaultLockDays]
        );
        return result.rows[0] || null;
    }

    /**
     * Update user lock settings
     */
    static async updateLockSettings(userId: string, updates: string): Promise<void> {
        await query(
            `UPDATE users 
             SET settings = COALESCE(settings, '{}'::jsonb) || ${updates}
             WHERE id = $1`,
            [userId]
        );
    }

    /**
     * Get transaction date and lock status
     */
    static async getTransactionLockStatus(transactionId: string, userId: string): Promise<any> {
        const result = await query(
            `SELECT transaction_date, is_locked FROM transactions WHERE id = $1 AND user_id = $2`,
            [transactionId, userId]
        );
        return result.rows[0] || null;
    }

    /**
     * Lock a transaction
     */
    static async lockTransaction(transactionId: string, userId: string, reason: string): Promise<void> {
        await query(
            `UPDATE transactions 
             SET is_locked = true, locked_at = NOW(), lock_reason = $3
             WHERE id = $1 AND user_id = $2`,
            [transactionId, userId, reason]
        );
    }

    /**
     * Unlock a transaction
     */
    static async unlockTransaction(transactionId: string, userId: string): Promise<void> {
        await query(
            `UPDATE transactions 
             SET is_locked = false, locked_at = NULL, lock_reason = NULL
             WHERE id = $1 AND user_id = $2`,
            [transactionId, userId]
        );
    }

    /**
     * Get locked transactions
     */
    static async getLockedTransactions(userId: string, lockCutoff: string): Promise<any[]> {
        const result = await query(
            `SELECT id, amount, description, transaction_date, is_locked, locked_at, lock_reason
             FROM transactions 
             WHERE user_id = $1 
             AND (is_locked = true OR transaction_date < $2)
             ORDER BY transaction_date DESC
             LIMIT 100`,
            [userId, lockCutoff]
        );
        return result.rows;
    }

    /**
     * Log lock action to audit trail
     */
    static async logLockAction(
        userId: string,
        transactionId: string,
        action: string,
        changes: any
    ): Promise<void> {
        await query(
            `INSERT INTO transaction_audit_log 
             (user_id, transaction_id, action, changes, changed_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [userId, transactionId, action, JSON.stringify(changes)]
        );
    }
}
