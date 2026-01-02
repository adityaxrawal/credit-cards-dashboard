/**
 * Envelope Budgeting Repository
 * Data access layer for category-based budget envelopes
 */

import { query } from '@shared/database/db';

export interface EnvelopeRow {
    id: string;
    user_id: string;
    category_id: string;
    month: number;
    year: number;
    allocated_amount: number;
    spent_amount: number;
    rollover_amount: number;
    created_at: Date;
    updated_at: Date;
    // Joined fields
    category_name?: string;
    category_icon?: string;
    category_color?: string;
}

export class EnvelopeRepository {
    /**
     * Get all envelopes for a user for a specific month
     */
    static async getByMonth(userId: string, month: number, year: number): Promise<EnvelopeRow[]> {
        const result = await query(
            `SELECT be.*, c.name as category_name, c.icon as category_icon, c.color as category_color
             FROM budget_envelopes be
             JOIN categories c ON be.category_id = c.id
             WHERE be.user_id = $1 AND be.month = $2 AND be.year = $3
             ORDER BY c.sort_order, c.name`,
            [userId, month, year]
        );
        return result.rows;
    }

    /**
     * Get or create an envelope
     */
    static async getOrCreate(
        userId: string,
        month: number,
        year: number,
        categoryId: string
    ): Promise<EnvelopeRow> {
        const result = await query(
            `INSERT INTO budget_envelopes (user_id, category_id, month, year, allocated_amount, spent_amount, rollover_amount)
             VALUES ($1, $2, $3, $4, 0, 0, 0)
             ON CONFLICT (user_id, category_id, month, year) DO NOTHING
             RETURNING *`,
            [userId, categoryId, month, year]
        );

        if (result.rows.length > 0) {
            return result.rows[0];
        }

        // If conflict, fetch existing
        const existing = await query(
            `SELECT * FROM budget_envelopes WHERE user_id = $1 AND category_id = $2 AND month = $3 AND year = $4`,
            [userId, categoryId, month, year]
        );
        return existing.rows[0];
    }

    /**
     * Update envelope allocation
     */
    static async updateAllocation(
        userId: string,
        categoryId: string,
        month: number,
        year: number,
        allocatedAmount: number
    ): Promise<EnvelopeRow | null> {
        const result = await query(
            `UPDATE budget_envelopes 
             SET allocated_amount = $5, updated_at = NOW()
             WHERE user_id = $1 AND category_id = $2 AND month = $3 AND year = $4
             RETURNING *`,
            [userId, categoryId, month, year, allocatedAmount]
        );
        return result.rows[0] || null;
    }

    /**
     * Update envelope spent amount
     */
    static async updateSpent(
        userId: string,
        categoryId: string,
        month: number,
        year: number,
        spentAmount: number
    ): Promise<EnvelopeRow | null> {
        const result = await query(
            `UPDATE budget_envelopes 
             SET spent_amount = $5, updated_at = NOW()
             WHERE user_id = $1 AND category_id = $2 AND month = $3 AND year = $4
             RETURNING *`,
            [userId, categoryId, month, year, spentAmount]
        );
        return result.rows[0] || null;
    }

    /**
     * Get spending by category for a month
     */
    static async getSpendingByCategory(userId: string, month: number, year: number): Promise<any[]> {
        const result = await query(
            `SELECT category_id, SUM(amount) as total_spent
             FROM transactions
             WHERE user_id = $1 
               AND EXTRACT(MONTH FROM transaction_date) = $2
               AND EXTRACT(YEAR FROM transaction_date) = $3
               AND transaction_type = 'debit'
             GROUP BY category_id`,
            [userId, month, year]
        );
        return result.rows;
    }
}
