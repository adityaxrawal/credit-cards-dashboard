
/**
 * Envelope Budgeting Service
 * Manages the distribution of monthly budget into specific category envelopes.
 */

import { EnvelopeRepository } from '../../repositories/EnvelopeRepository';
import { CategoryRepository } from '@modules/categories/categories.repository';
import { invalidateBudgetCache } from '@shared/utils/cache/cacheInvalidation';

export interface Envelope {
    categoryId: string;
    categoryName: string;
    allocatedAmount: number;
    spentAmount: number;
    remainingAmount: number;
}

export class EnvelopeBudgetingService {
    /**
     * Get all budget envelopes for a user for a specific month/year
     */
    static async getEnvelopes(userId: string, month: number, year: number): Promise<Envelope[]> {
        // 1. Get all categories
        const categories = await CategoryRepository.findAll();

        // 2. Get existing allocations for this month
        const allocations = await EnvelopeRepository.getByMonth(userId, month, year);

        const allocationMap = new Map<string, number>();
        allocations.forEach(row => {
            allocationMap.set(row.category_id, parseFloat(String(row.allocated_amount)));
        });

        // 3. Get actual spending by category for this month
        const spendingRows = await EnvelopeRepository.getSpendingByCategory(userId, month, year);

        const spendingMap = new Map<string, number>();
        spendingRows.forEach(row => {
            spendingMap.set(row.category_id, parseFloat(String(row.total_spent)) || 0);
        });

        // 4. Construct envelopes
        const envelopes: Envelope[] = categories.map(cat => {
            const allocated = allocationMap.get(cat.id) || 0;
            const spent = spendingMap.get(cat.id) || 0;

            return {
                categoryId: cat.id,
                categoryName: cat.name,
                allocatedAmount: allocated,
                spentAmount: spent,
                remainingAmount: allocated - spent
            };
        });

        return envelopes;
    }

    /**
     * Set or update a budget envelope for a category
     */
    static async setEnvelope(userId: string, month: number, year: number, categoryId: string, amount: number) {
        // Get or create the envelope first
        await EnvelopeRepository.getOrCreate(userId, month, year, categoryId);

        // Update the allocation
        await EnvelopeRepository.updateAllocation(userId, categoryId, month, year, amount);

        await invalidateBudgetCache(userId);
    }

    /**
     * Distribute total budget across envelopes automatically based on history
     * (Simple heuristic: Average of last 3 months)
     */
    /**
     * Distribute total budget across envelopes automatically based on history
     * (Simple heuristic: Average of last 3 months)
     */
    static async autoDistribute(userId: string, month: number, year: number, totalBudget: number) {
        // 1. Get average spending per category from last 3 months
        // This is a new method we expect in TransactionRepository
        const history = await import('@modules/transactions/repositories/TransactionRepository')
            .then(m => m.TransactionRepository.getCategorySpendingHistory(userId, 3));

        if (history.length === 0) {
            return false; // No history to base distribution on
        }

        // 2. Calculate proportions
        const totalAverageSpending = history.reduce((sum, item) => sum + item.averageAmount, 0);

        if (totalAverageSpending === 0) {
            return false;
        }

        // 3. Distribute new budget
        for (const item of history) {
            const ratio = item.averageAmount / totalAverageSpending;
            const allocation = Math.round(totalBudget * ratio);

            if (allocation > 0) {
                // Determine category ID from name (EnvelopeRepository expects ID)
                const category = await CategoryRepository.findByName(item.category);
                if (category) {
                    await this.setEnvelope(userId, month, year, category.id, allocation);
                }
            }
        }

        return true;
    }
}
