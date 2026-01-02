/**
 * Budget Repository
 * Data access layer for budget-related operations
 */

import { query } from '../lib/db';

export class BudgetRepository {
    /**
     * Get user's monthly budget from users table
     */
    static async getUserMonthlyBudget(userId: string): Promise<number> {
        const result = await query(
            'SELECT monthly_budget FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            throw new Error('User not found');
        }

        return parseFloat(result.rows[0].monthly_budget || '0');
    }

    /**
     * Update user's monthly budget
     */
    static async updateUserMonthlyBudget(userId: string, newBudget: number): Promise<void> {
        await query(
            'UPDATE users SET monthly_budget = $1, updated_at = NOW() WHERE id = $2',
            [newBudget, userId]
        );
    }

    /**
     * Create a budget rule (like savings link)
     */
    static async createBudgetRule(
        userId: string,
        name: string,
        type: string,
        config: any
    ): Promise<void> {
        await query(
            `INSERT INTO budget_rules (user_id, name, type, config, is_enabled)
             VALUES ($1, $2, $3, $4, true)
             ON CONFLICT (id) DO NOTHING`,
            [userId, name, type, JSON.stringify(config)]
        );
    }

    /**
     * Get or create budget tracking for a month
     */
    static async getOrCreateBudgetTracking(
        userId: string,
        month: number,
        year: number,
        budgetLimit: number
    ): Promise<any> {
        // Try to get existing
        const { rows: existing } = await query(
            `SELECT * FROM budget_tracking 
             WHERE user_id = $1 AND month = $2 AND year = $3`,
            [userId, month, year]
        );

        if (existing.length > 0) {
            return existing[0];
        }

        // Create new
        const { rows } = await query(
            `INSERT INTO budget_tracking (user_id, month, year, budget_limit)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [userId, month, year, budgetLimit]
        );

        return rows[0];
    }

    /**
     * Update budget tracking
     */
    static async updateBudgetTracking(
        userId: string,
        month: number,
        year: number,
        data: Partial<{
            budgetLimit: number;
            totalSpent: number;
            alertSent: boolean;
        }>
    ): Promise<any | null> {
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.budgetLimit !== undefined) {
            updates.push(`budget_limit = $${paramIndex++}`);
            values.push(data.budgetLimit);
        }

        if (data.totalSpent !== undefined) {
            updates.push(`total_spent = $${paramIndex++}`);
            values.push(data.totalSpent);
        }

        if (data.alertSent !== undefined) {
            updates.push(`alert_sent = $${paramIndex++}`);
            values.push(data.alertSent);
            if (data.alertSent) {
                updates.push(`alert_sent_at = NOW()`);
            }
        }

        if (updates.length === 0) return null;

        updates.push(`updated_at = NOW()`);
        values.push(userId, month, year);

        const { rows } = await query(
            `UPDATE budget_tracking 
             SET ${updates.join(', ')}
             WHERE user_id = $${paramIndex++} AND month = $${paramIndex++} AND year = $${paramIndex++}
             RETURNING *`,
            values
        );

        return rows[0] || null;
    }

    /**
     * Get budget history
     */
    static async getHistory(userId: string, limit: number = 12): Promise<any[]> {
        const { rows } = await query(
            `SELECT * FROM budget_tracking
             WHERE user_id = $1
             ORDER BY year DESC, month DESC
             LIMIT $2`,
            [userId, limit]
        );
        return rows;
    }
}
