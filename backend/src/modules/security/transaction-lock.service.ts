import { TransactionLockRepository } from '@modules/transactions/repositories/TransactionLockRepository';
import dayjs from 'dayjs';

/**
 * Transaction Lock Service
 * Prevents modification of transactions older than N days
 * Configurable per user or global setting
 */

const DEFAULT_LOCK_DAYS = 30;

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
        const row = await TransactionLockRepository.getLockSettings(userId, DEFAULT_LOCK_DAYS);

        if (!row) {
            return {
                lockDays: DEFAULT_LOCK_DAYS,
                enabled: true,
                allowAdminOverride: false,
            };
        }

        return {
            lockDays: row.lock_days,
            enabled: row.enabled,
            allowAdminOverride: row.allow_admin_override,
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
            await TransactionLockRepository.updateLockSettings(userId, `jsonb_build_object(${updates.join(', ')})`);
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

        const row = await TransactionLockRepository.getTransactionLockStatus(transactionId, userId);

        if (!row) {
            return { locked: false, reason: 'Transaction not found' };
        }

        // Check if explicitly locked
        if (row.is_locked) {
            return {
                locked: true,
                reason: 'Transaction has been explicitly locked',
                lockDate: row.transaction_date,
            };
        }

        // Check age-based lock
        const transactionDate = dayjs(row.transaction_date);
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
        await TransactionLockRepository.lockTransaction(transactionId, userId, reason || 'Manually locked');
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

        await TransactionLockRepository.unlockTransaction(transactionId, userId);
        await this.logLockAction(userId, transactionId, 'unlock', 'Admin override');

        return { success: true };
    }

    /**
     * Get all locked transactions for a user
     */
    async getLockedTransactions(userId: string): Promise<any[]> {
        const settings = await this.getLockSettings(userId);
        const lockCutoff = dayjs().subtract(settings.lockDays, 'day').format('YYYY-MM-DD');
        return TransactionLockRepository.getLockedTransactions(userId, lockCutoff);
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
        await TransactionLockRepository.logLockAction(userId, transactionId, action, { action, reason });
    }
}

export const transactionLockService = new TransactionLockService();
