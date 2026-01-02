/**
 * Lifecycle Repository
 * Data access layer for transaction lifecycle/status operations
 */

import { query } from '@shared/database/db';

export class LifecycleRepository {
    /**
     * Get transaction status
     */
    static async getTransactionStatus(transactionId: string): Promise<any> {
        const result = await query(
            `SELECT id, user_id, status, amount, direction, merchant_normalized as merchant
             FROM transactions WHERE id = $1`,
            [transactionId]
        );
        return result.rows[0] || null;
    }

    /**
     * Update transaction status
     */
    static async updateStatus(transactionId: string, newStatus: string, metadata?: any): Promise<void> {
        await query(
            `UPDATE transactions 
             SET status = $2, 
                 metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE($3::jsonb, '{}'::jsonb),
                 updated_at = NOW()
             WHERE id = $1`,
            [transactionId, newStatus, metadata ? JSON.stringify(metadata) : null]
        );
    }

    /**
     * Log status transition
     */
    static async logTransition(
        transactionId: string,
        userId: string,
        fromStatus: string | null,
        toStatus: string,
        reason?: string,
        source?: string
    ): Promise<void> {
        await query(
            `INSERT INTO transaction_audit_log 
             (user_id, transaction_id, action, changes, changed_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [
                userId,
                transactionId,
                'status_change',
                JSON.stringify({ fromStatus, toStatus, reason, source }),
            ]
        );
    }

    /**
     * Mark as disputed
     */
    static async markDisputed(transactionId: string, userId: string, reason?: string): Promise<boolean> {
        const result = await query(
            `UPDATE transactions 
             SET status = 'disputed', 
                 metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('disputeReason', $3, 'disputedAt', NOW()::text)
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [transactionId, userId, reason || 'User disputed']
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Mark as chargeback
     */
    static async markChargeback(transactionId: string, userId: string): Promise<boolean> {
        const result = await query(
            `UPDATE transactions 
             SET status = 'chargeback', 
                 metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('chargebackAt', NOW()::text)
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [transactionId, userId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Detect recurring transactions
     */
    static async detectRecurring(userId: string): Promise<any[]> {
        const result = await query(
            `SELECT id FROM transactions
             WHERE user_id = $1 
               AND merchant_normalized IN (
                   SELECT merchant_normalized FROM recurring_patterns
                   WHERE user_id = $1 AND status = 'active'
               )
               AND is_recurring IS NOT TRUE`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Mark as recurring
     */
    static async markRecurring(transactionId: string, patternId: string): Promise<void> {
        await query(
            `UPDATE transactions 
             SET is_recurring = true, recurring_pattern_id = $2
             WHERE id = $1`,
            [transactionId, patternId]
        );
    }

    /**
     * Detect reversal pairs
     */
    static async detectReversals(userId: string): Promise<any[]> {
        const result = await query(
            `SELECT 
                d.id as debit_id, c.id as credit_id
             FROM transactions d
             JOIN transactions c ON 
                d.user_id = c.user_id AND
                d.amount = c.amount AND
                d.direction = 'debit' AND c.direction = 'credit' AND
                d.merchant_normalized = c.merchant_normalized AND
                ABS(EXTRACT(EPOCH FROM (d.transaction_date - c.transaction_date))) <= 86400 * 7
             WHERE d.user_id = $1 
               AND d.reversal_id IS NULL 
               AND c.reversal_id IS NULL
             LIMIT 50`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Link reversals
     */
    static async linkReversals(debitId: string, creditId: string): Promise<void> {
        await query(`UPDATE transactions SET reversal_id = $2 WHERE id = $1`, [debitId, creditId]);
        await query(`UPDATE transactions SET reversal_id = $1 WHERE id = $2`, [debitId, creditId]);
    }

    /**
     * Get pending transactions older than threshold
     */
    static async getPendingOlderThan(userId: string, daysOld: number): Promise<string[]> {
        const result = await query(
            `SELECT id FROM transactions
             WHERE user_id = $1 
               AND status = 'pending'
               AND transaction_date < CURRENT_DATE - $2 * INTERVAL '1 day'`,
            [userId, daysOld]
        );
        return result.rows.map(r => r.id);
    }

    /**
     * Auto-post pending transactions
     */
    static async autoPostPending(userId: string, transactionIds: string[]): Promise<number> {
        if (transactionIds.length === 0) return 0;

        const result = await query(
            `UPDATE transactions SET status = 'posted', updated_at = NOW()
             WHERE user_id = $1 AND id = ANY($2)`,
            [userId, transactionIds]
        );
        return result.rowCount ?? 0;
    }
}
