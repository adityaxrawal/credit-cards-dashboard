import { TransactionStatus } from '../../types/transaction.types';
import logger from '../../utils/infrastructure/logger';
import { TransactionRepository } from '../../repositories/TransactionRepository';

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
            // Get current status - userId is needed for repository but not passed here.
            // Assumption: we need to find the user first or update repository to not require user?
            // Existing code used `SELECT ... WHERE id = $1` without user_id restriction for fetch, but update used it?
            // Actually the original query: `SELECT transaction_status FROM transactions WHERE id = $1`
            // But update: `UPDATE ... WHERE id = $2` (no user check in original update query? Let's check original)

            // Original Update: `WHERE id = $2` 
            // Original code did NOT use user_id in transitionStatus. This is a security gap (IDOR) but for strict refactor I might need to support it.
            // However, TransactionRepository methods STRICTLY require userId.

            // To use TransactionRepository, I must provide userId.
            // But I don't have it here.
            // I should fetch the transaction first to get the userId?
            // Wait, TransactionRepository.findById requires userId.

            // I need a generic `TransactionRepository.adminFindById` or similar if I don't have userId.
            // OR I should change `transitionStatus` signature to require userId, but that breaks callers.

            // Let's assume for now I added a method to get userId by transactionId or use a repository method that allows it.
            // BUT, `TransactionRepository` is strictly user-scoped in my implementation.

            // Quick fix: Add `findByIdWithoutUser` to TransactionRepository or just query purely here?
            // "Services should only interact with repositories".
            // So I must add a support method to Repository.

            // For now, I will use a direct query via a new repository method `TransactionRepository.getBasicInfo(transactionId)` which returns `{userId, status}`.

            // Wait, looking at usage of `transitionStatus`. Who calls it?
            // Likely webhooks or internal jobs.

            // Let's add `TransactionRepository.updateStatusSystem(transactionId, status)`?

            // Using `TransactionRepository.getStatus` which I added requires userId.

            // I will update TransactionRepository to support these "system" level updates or require strictly userId.
            // If I look at `markDisputed`, it takes `userId`.

            // Let's fix `transitionStatus` to require `userId`?
            // The signature is public. Changing it is risky.

            // Let's check `TransactionRepository` again.
            // It has to be flexible.

            // For this refactor, I will modify TransactionRepository to have `transitionStatus` which takes just ID? 
            // Or `TransactionRepository.findByIdSystem(id)`.

            // Actually, if I look at `transitionStatus` signature: `(transactionId, newStatus, options)`.
            // I'll add `TransactionRepository.findUserByTransactionId(transactionId)` to help.

            // Let's assume I can update TransactionRepository to add `findUserIdByTransactionId`.

            const txn = await TransactionRepository.findUserIdByTransactionId(transactionId);
            if (!txn) {
                return { success: false, error: 'Transaction not found' };
            }

            const { userId, status: currentStatus } = txn;

            // Validate transition
            if (!options?.force) {
                const validNextStates = this.VALID_TRANSITIONS[currentStatus as TransactionStatus] || [];
                if (!validNextStates.includes(newStatus)) {
                    return {
                        success: false,
                        error: `Invalid transition from ${currentStatus} to ${newStatus}`
                    };
                }
            }

            // Perform transition
            await TransactionRepository.updateStatus(userId, transactionId, newStatus);

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
            return await TransactionRepository.markDisputed(userId, transactionId, reason || 'Disputed by user');
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
            return await TransactionRepository.markChargeback(userId, transactionId);
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
            const count = await TransactionRepository.detectRecurring(userId);
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
            return await TransactionRepository.detectReversals(userId);
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
            return await TransactionRepository.getPendingOlderThan(userId, daysOld);
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
            const count = await TransactionRepository.autoPostPending(userId, daysThreshold);
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
