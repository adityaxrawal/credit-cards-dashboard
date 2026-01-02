/**
 * Transaction Query Service
 * Read operations for transactions
 * 
 * Extracted from TransactionService as part of Issue #4 CQRS-lite decomposition
 */

import { TransactionRepository } from '@modules/transactions/repositories/TransactionRepository';
import { TransactionFilters } from '@shared/types/transaction.types';

export { TransactionFilters };

export class TransactionQueryService {
    /**
     * List transactions with filters and pagination
     */
    static async list(userId: string, filters: TransactionFilters = {}) {
        console.log(`[TransactionQueryService] Listing transactions for user ${userId}`, filters);

        const page = filters.page || 1;
        const limit = filters.limit || 50;
        const offset = (page - 1) * limit;

        const result = await TransactionRepository.list(userId, {
            ...filters,
            limit,
            offset,
            sortBy: filters.sortBy,
            sortOrder: filters.sortOrder,
        });

        const aggregations = await TransactionRepository.getAggregations(userId, {
            from: filters.from,
            to: filters.to,
            billMonth: filters.billMonth,
            billYear: filters.billYear,
        });

        return {
            data: result.data,
            pagination: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
            },
            aggregations,
        };
    }

    /**
     * Get a single transaction by ID
     */
    static async getById(userId: string, transactionId: string) {
        return await TransactionRepository.findById(userId, transactionId);
    }

    /**
     * Get spending aggregations
     */
    static async getAggregations(userId: string, filters: {
        from?: Date;
        to?: Date;
        billMonth?: number;
        billYear?: number;
    }) {
        return await TransactionRepository.getAggregations(userId, filters);
    }
}
