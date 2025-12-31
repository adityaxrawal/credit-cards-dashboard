import pool from '../../lib/db';
import dayjs from 'dayjs';

/**
 * Transaction Lock Service
 * Prevents modification of transactions older than N days
 * Configurable per user or global setting
 */

const DEFAULT_LOCK_DAYS = 30; // Default: lock transactions older than 30 days

export interface LockSettings {
    lockDays: number;
    enabled: boolean;
    allowAdminOverride: boolean;
}

export class TransactionLockService {
    /**
     * Get user's lock settings
     */
    async getLockSettings(userId: string): Promise<LockSettings> {
        const { rows } = await pool.query(
            `SELECT 
        COALESCE((settings->>'transaction_lock_days')::int, $2) as lock_days,
        COALESCE((settings->>'transaction_lock_enabled')::boolean, true) as enabled,
        COALESCE((settings->>'transaction_lock_admin_override')::boolean, false) as allow_admin_override
       FROM users WHERE id = $1`,
            [userId, DEFAULT_LOCK_DAYS]
        );

        if (rows.length === 0) {
            return {
                lockDays: DEFAULT_LOCK_DAYS,
                enabled: true,
                allowAdminOverride: false,
            };
        }

        return {
            lockDays: rows[0].lock_days,
            enabled: rows[0].enabled,
            allowAdminOverride: rows[0].allow_admin_override,
        };
    }

    /**
     * Update user's lock settings
     */
    async updateLockSettings(userId: string, settings: Partial<LockSettings>): Promise<void> {
        const updates: string[] = [];

        if (settings.lockDays !== undefined) {
            updates.push(`'transaction_lock_days', '${settings.lockDays}'`);
        }
        if (settings.enabled !== undefined) {
            updates.push(`'transaction_lock_enabled', '${settings.enabled}'`);
        }
        if (settings.allowAdminOverride !== undefined) {
            updates.push(`'transaction_lock_admin_override', '${settings.allowAdminOverride}'`);
        }

        if (updates.length > 0) {
            await pool.query(
                `UPDATE users 
         SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(${updates.join(', ')})
         WHERE id = $1`,
                [userId]
            );
        }
    }

    /**
     * Check if a transaction is locked
     */
    async isTransactionLocked(userId: string, transactionId: string): Promise<{ locked: boolean; reason?: string; lockDate?: string }> {
        const settings = await this.getLockSettings(userId);

        if (!settings.enabled) {
            return { locked: false };
        }

        const { rows } = await pool.query(
            `SELECT transaction_date, is_locked FROM transactions WHERE id = $1 AND user_id = $2`,
            [transactionId, userId]
        );

        if (rows.length === 0) {
            return { locked: false, reason: 'Transaction not found' };
        }

        // Check if explicitly locked
        if (rows[0].is_locked) {
            return {
                locked: true,
                reason: 'Transaction has been explicitly locked',
                lockDate: rows[0].transaction_date,
            };
        }

        // Check age-based lock
        const transactionDate = dayjs(rows[0].transaction_date);
        const lockCutoff = dayjs().subtract(settings.lockDays, 'day');

        if (transactionDate.isBefore(lockCutoff)) {
            return {
                locked: true,
                reason: `Transaction is older than ${settings.lockDays} days`,
                lockDate: lockCutoff.format('YYYY-MM-DD'),
            };
        }

        return { locked: false };
    }

    /**
     * Lock a specific transaction manually
     */
    async lockTransaction(userId: string, transactionId: string, reason?: string): Promise<void> {
        await pool.query(
            `UPDATE transactions 
       SET is_locked = true, locked_at = NOW(), lock_reason = $3
       WHERE id = $1 AND user_id = $2`,
            [transactionId, userId, reason || 'Manually locked']
        );

        // Log the action
        await this.logLockAction(userId, transactionId, 'lock', reason);
    }

    /**
     * Unlock a transaction (requires admin or explicit permission)
     */
    async unlockTransaction(userId: string, transactionId: string, adminOverride: boolean = false): Promise<{ success: boolean; error?: string }> {
        const settings = await this.getLockSettings(userId);

        if (!adminOverride && !settings.allowAdminOverride) {
            return { success: false, error: 'Unlock not permitted without admin override' };
        }

        await pool.query(
            `UPDATE transactions 
       SET is_locked = false, locked_at = NULL, lock_reason = NULL
       WHERE id = $1 AND user_id = $2`,
            [transactionId, userId]
        );

        await this.logLockAction(userId, transactionId, 'unlock', 'Admin override');

        return { success: true };
    }

    /**
     * Get all locked transactions for a user
     */
    async getLockedTransactions(userId: string): Promise<any[]> {
        const settings = await this.getLockSettings(userId);
        const lockCutoff = dayjs().subtract(settings.lockDays, 'day').format('YYYY-MM-DD');

        const { rows } = await pool.query(
            `SELECT id, amount, description, transaction_date, is_locked, locked_at, lock_reason
       FROM transactions 
       WHERE user_id = $1 
       AND (is_locked = true OR transaction_date < $2)
       ORDER BY transaction_date DESC
       LIMIT 100`,
            [userId, lockCutoff]
        );

        return rows;
    }

    /**
     * Validate if transaction can be modified
     */
    async validateModification(userId: string, transactionId: string): Promise<{ allowed: boolean; error?: string }> {
        const lockStatus = await this.isTransactionLocked(userId, transactionId);

        if (lockStatus.locked) {
            return {
                allowed: false,
                error: lockStatus.reason || 'Transaction is locked and cannot be modified'
            };
        }

        return { allowed: true };
    }

    private async logLockAction(userId: string, transactionId: string, action: 'lock' | 'unlock', reason?: string): Promise<void> {
        await pool.query(
            `INSERT INTO transaction_audit_log 
       (user_id, transaction_id, action, changes, changed_at)
       VALUES ($1, $2, $3, $4, NOW())`,
            [userId, transactionId, action, JSON.stringify({ action, reason })]
        );
    }
}

export const transactionLockService = new TransactionLockService();
