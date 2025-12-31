
/**
 * Envelope Budgeting Service
 * Manages the distribution of monthly budget into specific category envelopes.
 */

import pool from '../../lib/db';
import { invalidateBudgetCache } from '../../utils/cache/cacheInvalidation';

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
        const categoriesRes = await pool.query(
            `SELECT id, name FROM categories WHERE user_id = $1 OR user_id IS NULL`,
            [userId]
        );

        // 2. Get existing allocations for this month
        const allocationsRes = await pool.query(
            `SELECT category_id, amount FROM budget_envelopes 
       WHERE user_id = $1 AND month = $2 AND year = $3`,
            [userId, month, year]
        );

        const allocationMap = new Map<string, number>();
        allocationsRes.rows.forEach(row => {
            allocationMap.set(row.category_id, parseFloat(row.amount));
        });

        // 3. Get actual spending by category for this month
        // Note: This relies on your transaction categorization
        const spendingRes = await pool.query(
            `SELECT category, SUM(amount) as total 
       FROM transactions 
       WHERE user_id = $1 
         AND EXTRACT(MONTH FROM transaction_date) = $2 
         AND EXTRACT(YEAR FROM transaction_date) = $3
         AND direction = 'debit'
       GROUP BY category`,
            [userId, month, year]
        );

        const spendingMap = new Map<string, number>();
        spendingRes.rows.forEach(row => {
            // Map category name to spent amount. 
            // Ideally, transactions should link to category_id, but if they use name:
            // We need to match name to ID or vice versa.
            // Assuming simplistic string matching for now or that 'category' column holds the name.
            spendingMap.set(row.category, parseFloat(row.total));
        });

        // 4. Construct envelopes
        const envelopes: Envelope[] = categoriesRes.rows.map(cat => {
            const allocated = allocationMap.get(cat.id) || 0;
            // If transactions store category NAME, we look it up by name. 
            // If they store ID, we'd use ID. Let's assume Name for compatibility with typical CSV imports usually having names.
            const spent = spendingMap.get(cat.name) || 0;

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
        await pool.query(
            `INSERT INTO budget_envelopes (user_id, month, year, category_id, amount, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (user_id, month, year, category_id)
       DO UPDATE SET amount = $5, updated_at = NOW()`,
            [userId, month, year, categoryId, amount]
        );

        await invalidateBudgetCache(userId);
    }

    /**
     * Distribute total budget across envelopes automatically based on history
     * (Simple heuristic: Average of last 3 months)
     */
    static async autoDistribute(userId: string, month: number, year: number, totalBudget: number) {
        // TODO: Implement smart distribution logic
        // For now, just a stub to be expanded
        return false;
    }
}
