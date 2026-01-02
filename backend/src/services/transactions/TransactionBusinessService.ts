/**
 * Transaction Business Service
 * Business logic operations: split, link, resolve duplicates
 * 
 * Extracted from TransactionService as part of Issue #4 CQRS-lite decomposition
 */

import { executeTransaction } from '../../lib/db';
import { TransactionRepository } from '../../repositories/TransactionRepository';
import { invalidateTransactionCache } from '../../utils/cache/cacheInvalidation';

export class TransactionBusinessService {
    /**
     * Split a transaction into multiple child transactions
     */
    static async splitTransaction(
        userId: string,
        transactionId: string,
        splits: Array<{ amount: number; category: string; description?: string; merchant?: string }>
    ) {
        return executeTransaction(async (client) => {
            // Get original transaction
            const original = await TransactionRepository.findById(userId, transactionId, client);

            if (!original) throw new Error('Transaction not found');

            // Verify amounts sum correctly
            const totalSplit = splits.reduce((sum, s) => sum + s.amount, 0);
            if (Math.abs(totalSplit - Number(original.amount)) > 0.01) {
                throw new Error(`Split amounts (${totalSplit}) do not sum to total (${original.amount})`);
            }

            // Mark original as split
            await TransactionRepository.update(userId, transactionId, { isSplit: true }, client);

            // Create child transactions
            for (let i = 0; i < splits.length; i++) {
                const split = splits[i];
                await TransactionRepository.createSplitChild({
                    userId,
                    parentTransactionId: transactionId,
                    instrumentId: original.instrument_id!,
                    instrumentType: original.instrument_type || 'unknown',
                    transactionDate: original.transaction_date,
                    amount: split.amount,
                    currencyCode: 'INR', // Defaulting since it wasn't in original record interface clearly but was in query
                    direction: original.direction || 'debit',
                    merchant: split.merchant || original.merchant,
                    category: split.category,
                    description: (split.description || original.description) || undefined,
                    splitIndex: i,
                    billMonth: original.bill_month || 0,
                    billYear: original.bill_year || 0
                }, client);
            }

            await invalidateTransactionCache(userId);
            return true;
        });
    }

    /**
     * Resolve a duplicate transaction by keeping one and deleting the other
     */
    static async resolveDuplicate(
        userId: string,
        keepTransactionId: string,
        duplicateTransactionId: string
    ) {
        return executeTransaction(async (client) => {
            // Delete the duplicate
            await TransactionRepository.delete(userId, duplicateTransactionId, client);

            // Clear review flag on kept transaction
            await TransactionRepository.update(
                userId,
                keepTransactionId,
                { needsReview: false, reviewReason: null },
                client
            );

            await invalidateTransactionCache(userId);
            return true;
        });
    }

    /**
     * Link a refund transaction to its original transaction
     */
    static async linkRefund(
        userId: string,
        refundTransactionId: string,
        originalTransactionId: string
    ) {
        const success = await TransactionRepository.linkRefund(userId, refundTransactionId, originalTransactionId);

        if (success) {
            await invalidateTransactionCache(userId);
            return true;
        }
        return false;
    }
}
