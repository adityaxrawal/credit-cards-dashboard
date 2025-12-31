import pool from '../../lib/db';

export interface SharedExpenseInput {
    title: string;
    description?: string;
    totalAmount: number;
    currency?: string;
    expenseDate?: string;
    paidByUserId?: string;
    splits: {
        userId?: string;
        memberName: string;
        shareAmount?: number;
        sharePercent?: number;
    }[];
}

export interface SharedExpense {
    id: string;
    userId: string;
    groupName?: string;
    title: string;
    description?: string;
    totalAmount: number;
    currency: string;
    expenseDate: string;
    paidByUserId?: string;
    status: string;
    splits: ExpenseSplit[];
    createdAt: Date;
}

export interface ExpenseSplit {
    id: string;
    sharedExpenseId: string;
    userId?: string;
    memberName: string;
    shareAmount: number;
    sharePercent: number;
    isPaid: boolean;
    paidAt?: Date;
}

export class SharedExpenseService {
    /**
     * Create shared expense with splits
     */
    async create(userId: string, input: SharedExpenseInput): Promise<SharedExpense> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const expenseDate = input.expenseDate || new Date().toISOString().split('T')[0];

            // Create shared expense
            const expenseResult = await client.query(
                `INSERT INTO shared_expenses (
          user_id, title, description, total_amount, currency,
          expense_date, paid_by_user_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING *`,
                [
                    userId, input.title, input.description, input.totalAmount,
                    input.currency || 'INR', expenseDate, input.paidByUserId || userId
                ]
            );

            const expense = expenseResult.rows[0];

            // Calculate and create splits
            const splits: ExpenseSplit[] = [];
            for (const split of input.splits) {
                let shareAmount = split.shareAmount;
                let sharePercent = split.sharePercent;

                if (sharePercent && !shareAmount) {
                    shareAmount = (input.totalAmount * sharePercent) / 100;
                } else if (shareAmount && !sharePercent) {
                    sharePercent = (shareAmount / input.totalAmount) * 100;
                } else if (!shareAmount && !sharePercent) {
                    // Equal split
                    shareAmount = input.totalAmount / input.splits.length;
                    sharePercent = 100 / input.splits.length;
                }

                const splitResult = await client.query(
                    `INSERT INTO expense_splits (
            shared_expense_id, user_id, member_name, 
            share_amount, share_percent, is_paid
          ) VALUES ($1, $2, $3, $4, $5, false)
          RETURNING *`,
                    [expense.id, split.userId, split.memberName, shareAmount, sharePercent]
                );

                splits.push(this.mapSplitRow(splitResult.rows[0]));
            }

            await client.query('COMMIT');

            return {
                ...this.mapExpenseRow(expense),
                splits,
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get all shared expenses for user
     */
    async getAll(userId: string, filters?: { status?: string }): Promise<SharedExpense[]> {
        let query = `
      SELECT se.*, 
        json_agg(json_build_object(
          'id', es.id,
          'shared_expense_id', es.shared_expense_id,
          'user_id', es.user_id,
          'member_name', es.member_name,
          'share_amount', es.share_amount,
          'share_percent', es.share_percent,
          'is_paid', es.is_paid,
          'paid_at', es.paid_at
        )) as splits
      FROM shared_expenses se
      LEFT JOIN expense_splits es ON se.id = es.shared_expense_id
      WHERE se.user_id = $1
    `;

        const params: any[] = [userId];

        if (filters?.status) {
            params.push(filters.status);
            query += ` AND se.status = $${params.length}`;
        }

        query += ` GROUP BY se.id ORDER BY se.expense_date DESC`;

        const result = await pool.query(query, params);

        return result.rows.map(row => ({
            ...this.mapExpenseRow(row),
            splits: (row.splits || []).filter((s: any) => s.id).map(this.mapSplitRow),
        }));
    }

    /**
     * Get expense by ID
     */
    async getById(userId: string, id: string): Promise<SharedExpense | null> {
        const result = await pool.query(
            `SELECT se.*, 
        json_agg(json_build_object(
          'id', es.id,
          'shared_expense_id', es.shared_expense_id,
          'user_id', es.user_id,
          'member_name', es.member_name,
          'share_amount', es.share_amount,
          'share_percent', es.share_percent,
          'is_paid', es.is_paid,
          'paid_at', es.paid_at
        )) as splits
       FROM shared_expenses se
       LEFT JOIN expense_splits es ON se.id = es.shared_expense_id
       WHERE se.id = $1 AND se.user_id = $2
       GROUP BY se.id`,
            [id, userId]
        );

        if (result.rows.length === 0) return null;

        return {
            ...this.mapExpenseRow(result.rows[0]),
            splits: (result.rows[0].splits || []).filter((s: any) => s.id).map(this.mapSplitRow),
        };
    }

    /**
     * Mark split as paid
     */
    async markSplitPaid(userId: string, splitId: string): Promise<ExpenseSplit> {
        // Verify ownership
        const checkResult = await pool.query(
            `SELECT es.* FROM expense_splits es
       JOIN shared_expenses se ON es.shared_expense_id = se.id
       WHERE es.id = $1 AND se.user_id = $2`,
            [splitId, userId]
        );

        if (checkResult.rows.length === 0) {
            throw new Error('Split not found or access denied');
        }

        const result = await pool.query(
            `UPDATE expense_splits SET is_paid = true, paid_at = NOW()
       WHERE id = $1 RETURNING *`,
            [splitId]
        );

        // Check if all splits are paid, update expense status
        await this.updateExpenseStatus(checkResult.rows[0].shared_expense_id);

        return this.mapSplitRow(result.rows[0]);
    }

    /**
     * Get settlement summary - who owes whom
     */
    async getSettlementSummary(userId: string): Promise<any[]> {
        const result = await pool.query(
            `SELECT 
        es.member_name,
        SUM(CASE WHEN es.is_paid = false THEN es.share_amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN es.is_paid = true THEN es.share_amount ELSE 0 END) as paid_amount,
        COUNT(CASE WHEN es.is_paid = false THEN 1 END) as pending_count,
        COUNT(CASE WHEN es.is_paid = true THEN 1 END) as paid_count
       FROM expense_splits es
       JOIN shared_expenses se ON es.shared_expense_id = se.id
       WHERE se.user_id = $1
       GROUP BY es.member_name
       ORDER BY pending_amount DESC`,
            [userId]
        );

        return result.rows;
    }

    /**
     * Delete shared expense
     */
    async delete(userId: string, id: string): Promise<void> {
        await pool.query(
            'DELETE FROM shared_expenses WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
    }

    private async updateExpenseStatus(expenseId: string): Promise<void> {
        const result = await pool.query(
            `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_paid = true THEN 1 END) as paid
       FROM expense_splits WHERE shared_expense_id = $1`,
            [expenseId]
        );

        const { total, paid } = result.rows[0];
        const status = parseInt(paid) === parseInt(total) ? 'settled' : 'pending';

        await pool.query(
            'UPDATE shared_expenses SET status = $1 WHERE id = $2',
            [status, expenseId]
        );
    }

    private mapExpenseRow(row: any): Omit<SharedExpense, 'splits'> {
        return {
            id: row.id,
            userId: row.user_id,
            groupName: row.group_name,
            title: row.title,
            description: row.description,
            totalAmount: parseFloat(row.total_amount),
            currency: row.currency,
            expenseDate: row.expense_date,
            paidByUserId: row.paid_by_user_id,
            status: row.status,
            createdAt: row.created_at,
        };
    }

    private mapSplitRow(row: any): ExpenseSplit {
        return {
            id: row.id,
            sharedExpenseId: row.shared_expense_id,
            userId: row.user_id,
            memberName: row.member_name,
            shareAmount: parseFloat(row.share_amount),
            sharePercent: parseFloat(row.share_percent),
            isPaid: row.is_paid,
            paidAt: row.paid_at,
        };
    }
}
