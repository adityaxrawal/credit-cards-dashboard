import pool from '../../lib/db';
import { TransactionStatus } from '../../types/transaction.types';
import logger from '../../utils/infrastructure/logger';

/**
 * Transaction lifecycle event
 */
export interface LifecycleEvent {
    transactionId: string;
    fromStatus: TransactionStatus | null;
    toStatus: TransactionStatus;
    timestamp: Date;
    reason?: string;
    source?: string; // email, manual, system
}

/**
 * LifecycleService - Manages transaction status transitions
 * 
 * Handles:
 * - pending → posted transitions
 * - dispute/chargeback flows
 * - reversal detection
 * - recurring transaction detection
 */
export class LifecycleService {
    /**
     * Valid status transitions
     */
    private static readonly VALID_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
        [TransactionStatus.PENDING]: [TransactionStatus.POSTED, TransactionStatus.FAILED, TransactionStatus.REVERSED],
        [TransactionStatus.POSTED]: [TransactionStatus.REVERSED],
        [TransactionStatus.HOLD]: [TransactionStatus.POSTED, TransactionStatus.REVERSED, TransactionStatus.FAILED],
        [TransactionStatus.REVERSED]: [], // Terminal state
        [TransactionStatus.FAILED]: [TransactionStatus.PENDING], // Retry
    };

    /**
     * Transition a transaction to a new status
     */
    static async transitionStatus(
        transactionId: string,
        newStatus: TransactionStatus,
        options?: {
            reason?: string;
            source?: string;
            force?: boolean; // Skip validation
        }
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Get current status
            const current = await pool.query(
                `SELECT transaction_status FROM transactions WHERE id = $1`,
                [transactionId]
            );

            if (current.rows.length === 0) {
                return { success: false, error: 'Transaction not found' };
            }

            const currentStatus = (current.rows[0].transaction_status as TransactionStatus) || TransactionStatus.POSTED;

            // Validate transition
            if (!options?.force) {
                const validNextStates = this.VALID_TRANSITIONS[currentStatus] || [];
                if (!validNextStates.includes(newStatus)) {
                    return {
                        success: false,
                        error: `Invalid transition from ${currentStatus} to ${newStatus}`
                    };
                }
            }

            // Perform transition
            await pool.query(
                `UPDATE transactions 
                 SET transaction_status = $1, 
                     updated_at = NOW()
                 WHERE id = $2`,
                [newStatus, transactionId]
            );

            logger.info(`[Lifecycle] Transaction ${transactionId} transitioned: ${currentStatus} → ${newStatus}`);

            return { success: true };
        } catch (error) {
            logger.error('[Lifecycle] Failed to transition status:', error);
            return { success: false, error: 'Database error' };
        }
    }

    /**
     * Mark transaction as disputed
     */
    static async markDisputed(
        transactionId: string,
        userId: string,
        reason?: string
    ): Promise<boolean> {
        try {
            const result = await pool.query(
                `UPDATE transactions 
                 SET dispute_flag = TRUE,
                     review_reason = COALESCE($1, review_reason, 'Disputed by user'),
                     needs_review = TRUE,
                     updated_at = NOW()
                 WHERE id = $2 AND user_id = $3`,
                [reason, transactionId, userId]
            );
            return (result.rowCount ?? 0) > 0;
        } catch (error) {
            logger.error('[Lifecycle] Failed to mark disputed:', error);
            return false;
        }
    }

    /**
     * Mark transaction as chargeback
     */
    static async markChargeback(
        transactionId: string,
        userId: string
    ): Promise<boolean> {
        try {
            const result = await pool.query(
                `UPDATE transactions 
                 SET chargeback_flag = TRUE,
                     dispute_flag = TRUE,
                     updated_at = NOW()
                 WHERE id = $2 AND user_id = $3`,
                [transactionId, userId]
            );
            return (result.rowCount ?? 0) > 0;
        } catch (error) {
            logger.error('[Lifecycle] Failed to mark chargeback:', error);
            return false;
        }
    }

    /**
     * Detect and mark recurring transactions
     */
    static async detectRecurring(userId: string): Promise<number> {
        try {
            // Find transactions with same merchant/amount appearing monthly
            const result = await pool.query(
                `WITH recurring_candidates AS (
                    SELECT 
                        merchant,
                        amount,
                        COUNT(*) as occurrence_count,
                        ARRAY_AGG(id) as transaction_ids
                    FROM transactions
                    WHERE user_id = $1
                      AND transaction_date > NOW() - INTERVAL '6 months'
                      AND is_recurring = FALSE
                    GROUP BY merchant, amount
                    HAVING COUNT(*) >= 2
                )
                UPDATE transactions t
                SET is_recurring = TRUE, updated_at = NOW()
                FROM recurring_candidates rc
                WHERE t.id = ANY(rc.transaction_ids)
                  AND t.is_recurring = FALSE
                RETURNING t.id`,
                [userId]
            );

            const count = result.rows.length;
            if (count > 0) {
                logger.info(`[Lifecycle] Detected ${count} recurring transactions for user ${userId}`);
            }
            return count;
        } catch (error) {
            logger.error('[Lifecycle] Failed to detect recurring:', error);
            return 0;
        }
    }

    /**
     * Detect and mark reversal transactions
     */
    static async detectReversals(userId: string): Promise<number> {
        try {
            // Find reversals: credit transactions following a debit with same amount/merchant
            const result = await pool.query(
                `UPDATE transactions credit_txn
                 SET is_reversal = TRUE,
                     linked_transaction_id = debit_txn.id,
                     link_type = 'reversal',
                     updated_at = NOW()
                 FROM transactions debit_txn
                 WHERE credit_txn.user_id = $1
                   AND debit_txn.user_id = $1
                   AND credit_txn.direction = 'credit'
                   AND debit_txn.direction = 'debit'
                   AND credit_txn.amount = debit_txn.amount
                   AND LOWER(TRIM(credit_txn.merchant)) = LOWER(TRIM(debit_txn.merchant))
                   AND credit_txn.transaction_date > debit_txn.transaction_date
                   AND credit_txn.transaction_date < debit_txn.transaction_date + INTERVAL '30 days'
                   AND credit_txn.is_reversal = FALSE
                   AND credit_txn.linked_transaction_id IS NULL
                 RETURNING credit_txn.id`,
                [userId]
            );

            return result.rows.length;
        } catch (error) {
            logger.error('[Lifecycle] Failed to detect reversals:', error);
            return 0;
        }
    }

    /**
     * Get pending transactions older than threshold
     */
    static async getPendingOlderThan(
        userId: string,
        daysOld: number
    ): Promise<string[]> {
        try {
            const result = await pool.query(
                `SELECT id FROM transactions
                 WHERE user_id = $1
                   AND transaction_status = 'pending'
                   AND transaction_date < NOW() - INTERVAL '${daysOld} days'`,
                [userId]
            );
            return result.rows.map(r => r.id);
        } catch (error) {
            logger.error('[Lifecycle] Failed to get pending transactions:', error);
            return [];
        }
    }

    /**
     * Auto-post pending transactions older than threshold
     */
    static async autoPostPending(userId: string, daysThreshold: number = 3): Promise<number> {
        try {
            const result = await pool.query(
                `UPDATE transactions
                 SET transaction_status = 'posted',
                     is_provisional = FALSE,
                     updated_at = NOW()
                 WHERE user_id = $1
                   AND transaction_status = 'pending'
                   AND transaction_date < NOW() - INTERVAL '${daysThreshold} days'
                 RETURNING id`,
                [userId]
            );

            const count = result.rows.length;
            if (count > 0) {
                logger.info(`[Lifecycle] Auto-posted ${count} pending transactions for user ${userId}`);
            }
            return count;
        } catch (error) {
            logger.error('[Lifecycle] Failed to auto-post pending:', error);
            return 0;
        }
    }
}
