/**
 * Transaction Command Service
 * Write operations for transactions (Create, Update, Delete)
 * 
 * Extracted from TransactionService as part of Issue #4 CQRS-lite decomposition
 */

import { TransactionRepository } from '../../repositories/TransactionRepository';
import dayjs from 'dayjs';
import { TransactionMetadata, Transaction } from '../../types/transaction.types';
import { invalidateTransactionCache } from '../../utils/cache/cacheInvalidation';

export class TransactionCommandService {
    /**
     * Create a manual transaction
     */
    static async createManual(data: {
        userId: string;
        instrumentType: string;
        instrumentId: string;
        transactionDate: Date;
        merchant: string;
        category: string;
        amount: number;
        transactionType: string;
        direction: 'credit' | 'debit';
        description?: string;
        metadata?: TransactionMetadata;
        parentTransactionId?: string;
    }) {
        console.log(`[TransactionCommandService] Creating manual transaction for user ${data.userId}`);

        const txDate = dayjs(data.transactionDate);
        const billMonth = txDate.month() + 1;
        const billYear = txDate.year();

        const result = await TransactionRepository.create({
            userId: data.userId,
            instrumentType: data.instrumentType,
            instrumentId: data.instrumentId,
            transactionDate: data.transactionDate,
            merchant: data.merchant,
            category: data.category,
            amount: data.amount,
            transactionType: data.transactionType,
            direction: data.direction,
            description: data.description,
            billMonth,
            billYear,
            isManuallyAdded: true,
            metadata: data.metadata,
            classificationMethod: 'manual',
            parentTransactionId: data.parentTransactionId
        });

        if (result) {
            await invalidateTransactionCache(data.userId);
        }
        return result;
    }

    /**
     * Update a transaction
     */
    static async update(
        userId: string,
        transactionId: string,
        data: Partial<Transaction>
    ) {
        // TransactionRepository.update supports these fields
        const result = await TransactionRepository.update(userId, transactionId, data);
        if (result) {
            await invalidateTransactionCache(userId);
        }
        return result;
    }

    /**
     * Delete a transaction
     */
    static async delete(userId: string, transactionId: string) {
        const result = await TransactionRepository.delete(userId, transactionId);
        if (result) {
            await invalidateTransactionCache(userId);
        }
        return result;
    }

    /**
     * Bulk update transactions
     */
    static async bulkUpdate(
        userId: string,
        transactionIds: string[],
        updates: Partial<Transaction>
    ): Promise<{ updated: number; failed: number }> {
        console.log(`[TransactionCommandService] Bulk updating ${transactionIds.length} transactions`);

        let updated = 0;
        let failed = 0;

        for (const id of transactionIds) {
            try {
                const result = await TransactionRepository.update(userId, id, updates);
                if (result) {
                    updated++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error(`Failed to update transaction ${id}:`, error);
                failed++;
            }
        }

        if (updated > 0) {
            await invalidateTransactionCache(userId);
        }

        return { updated, failed };
    }

    /**
     * Bulk delete transactions
     */
    static async bulkDelete(
        userId: string,
        transactionIds: string[]
    ): Promise<{ deleted: number; failed: number }> {
        console.log(`[TransactionCommandService] Bulk deleting ${transactionIds.length} transactions`);

        let deleted = 0;
        let failed = 0;

        for (const id of transactionIds) {
            try {
                const result = await TransactionRepository.delete(userId, id);
                if (result) {
                    deleted++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error(`Failed to delete transaction ${id}:`, error);
                failed++;
            }
        }

        if (deleted > 0) {
            await invalidateTransactionCache(userId);
        }

        return { deleted, failed };
    }
}
