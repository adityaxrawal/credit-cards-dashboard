/**
 * Shared Expense Repository
 * Data access layer for shared/split expenses
 */

import pool, { query } from '@shared/database/db';

export class SharedExpenseRepository {
    /**
     * Create shared expense
     */
    static async create(data: {
        userId: string;
        groupName?: string;
        title: string;
        description?: string;
        totalAmount: number;
        currency: string;
        expenseDate: string;
        paidByUserId?: string;
    }): Promise<any> {
        const result = await query(
            `INSERT INTO shared_expenses 
             (user_id, group_name, title, description, total_amount, currency, expense_date, paid_by_user_id, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
             RETURNING *`,
            [
                data.userId,
                data.groupName || null,
                data.title,
                data.description || null,
                data.totalAmount,
                data.currency,
                data.expenseDate,
                data.paidByUserId || null,
            ]
        );
        return result.rows[0];
    }

    /**
     * Create expense split
     */
    static async createSplit(expenseId: string, split: {
        userId?: string;
        memberName: string;
        shareAmount: number;
        sharePercent: number;
    }): Promise<any> {
        const result = await query(
            `INSERT INTO expense_splits 
             (shared_expense_id, user_id, member_name, share_amount, share_percent, is_paid, created_at)
             VALUES ($1, $2, $3, $4, $5, false, NOW())
             RETURNING *`,
            [expenseId, split.userId || null, split.memberName, split.shareAmount, split.sharePercent]
        );
        return result.rows[0];
    }

    /**
     * Get all shared expenses for user
     */
    static async findAll(userId: string, status?: string): Promise<any[]> {
        let sql = `SELECT * FROM shared_expenses WHERE user_id = $1`;
        const params: any[] = [userId];

        if (status) {
            sql += ` AND status = $2`;
            params.push(status);
        }

        sql += ` ORDER BY expense_date DESC`;
        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Get expense by ID
     */
    static async findById(expenseId: string, userId: string): Promise<any> {
        const result = await query(
            `SELECT * FROM shared_expenses WHERE id = $1 AND user_id = $2`,
            [expenseId, userId]
        );
        return result.rows[0] || null;
    }

    /**
     * Get splits for expense
     */
    static async getSplits(expenseId: string): Promise<any[]> {
        const result = await query(
            `SELECT * FROM expense_splits WHERE shared_expense_id = $1`,
            [expenseId]
        );
        return result.rows;
    }

    /**
     * Mark split as paid
     */
    static async markSplitPaid(splitId: string): Promise<any> {
        const result = await query(
            `UPDATE expense_splits 
             SET is_paid = true, paid_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [splitId]
        );
        return result.rows[0];
    }

    /**
     * Get settlement summary
     */
    static async getSettlementSummary(userId: string): Promise<any[]> {
        const result = await query(
            `SELECT 
                es.member_name,
                SUM(CASE WHEN es.is_paid = false THEN es.share_amount ELSE 0 END) as owed,
                SUM(es.share_amount) as total
             FROM expense_splits es
             JOIN shared_expenses se ON es.shared_expense_id = se.id
             WHERE se.user_id = $1
             GROUP BY es.member_name
             ORDER BY owed DESC`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Delete expense and splits
     */
    static async delete(expenseId: string, userId: string): Promise<void> {
        await query(`DELETE FROM expense_splits WHERE shared_expense_id = $1`, [expenseId]);
        await query(`DELETE FROM shared_expenses WHERE id = $1 AND user_id = $2`, [expenseId, userId]);
    }

    /**
     * Update expense status
     */
    static async updateStatus(expenseId: string): Promise<void> {
        await query(
            `UPDATE shared_expenses se
             SET status = CASE 
                WHEN (SELECT COUNT(*) FROM expense_splits WHERE shared_expense_id = se.id AND is_paid = false) = 0 
                THEN 'settled' ELSE 'pending' END
             WHERE id = $1`,
            [expenseId]
        );
    }
}
