/**
 * Dashboard Repository
 * Data access layer for dashboard aggregations and queries
 */

import { query } from '@shared/database/db';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export class DashboardRepository {
    /**
     * Get account balances by type
     */
    static async getAccountBalancesByType(userId: string): Promise<any[]> {
        const result = await query(
            `SELECT type, COALESCE(SUM(balance), 0) as total, COUNT(*) as count
             FROM instruments
             WHERE user_id = $1 AND status = 'active'
             GROUP BY type`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Get credit card outstanding
     */
    static async getCreditCardOutstanding(userId: string): Promise<number> {
        const result = await query(
            `SELECT COALESCE(SUM(ABS(balance)), 0) as total
             FROM instruments
             WHERE user_id = $1 AND type = 'credit_card' AND status = 'active'`,
            [userId]
        );
        return parseFloat(result.rows[0]?.total) || 0;
    }

    /**
     * Get loans outstanding
     */
    static async getLoansOutstanding(userId: string): Promise<number> {
        const result = await query(
            `SELECT COALESCE(SUM(current_outstanding), 0) as total
             FROM loans
             WHERE user_id = $1 AND status = 'active'`,
            [userId]
        );
        return parseFloat(result.rows[0]?.total) || 0;
    }

    /**
     * Get monthly spending summary
     */
    static async getMonthlySpending(userId: string, month: number, year: number): Promise<{ total: number; byCategory: any[] }> {
        const result = await query(
            `SELECT 
                category,
                COALESCE(SUM(amount), 0) as total
             FROM transactions
             WHERE user_id = $1 
               AND EXTRACT(MONTH FROM transaction_date) = $2
               AND EXTRACT(YEAR FROM transaction_date) = $3
               AND direction = 'debit'
             GROUP BY category`,
            [userId, month, year]
        );

        const total = result.rows.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
        return { total, byCategory: result.rows };
    }

    /**
     * Get overdue bills
     */
    static async getOverdueBills(userId: string): Promise<any[]> {
        const result = await query(
            `SELECT id, name, amount, due_date
             FROM bills
             WHERE user_id = $1 AND status = 'pending' AND due_date < CURRENT_DATE
             ORDER BY due_date`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Get upcoming bills (next N days)
     */
    static async getUpcomingBills(userId: string, daysAhead: number = 7): Promise<any[]> {
        const result = await query(
            `SELECT id, name, amount, due_date
             FROM bills
             WHERE user_id = $1 
               AND status = 'pending' 
               AND due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + $2 * INTERVAL '1 day')
             ORDER BY due_date
             LIMIT 10`,
            [userId, daysAhead]
        );
        return result.rows;
    }

    /**
     * Get low balance accounts
     */
    static async getLowBalanceAccounts(userId: string, threshold: number = 5000): Promise<any[]> {
        const result = await query(
            `SELECT id, name, balance, type
             FROM instruments
             WHERE user_id = $1 
               AND status = 'active'
               AND type IN ('bank_account', 'wallet')
               AND balance < $2
             ORDER BY balance`,
            [userId, threshold]
        );
        return result.rows;
    }

    /**
     * Get high credit utilization cards
     */
    static async getHighCreditUtilization(userId: string, threshold: number = 0.8): Promise<any[]> {
        const result = await query(
            `SELECT id, name, 
                    (metadata->>'credit_limit')::decimal as credit_limit, 
                    ABS(balance) as credit_used,
                    CASE WHEN (metadata->>'credit_limit')::decimal > 0 
                         THEN ABS(balance)::float / (metadata->>'credit_limit')::decimal 
                         ELSE 0 END as utilization
             FROM instruments
             WHERE user_id = $1 
               AND type = 'credit_card' 
               AND status = 'active'
               AND (metadata->>'credit_limit')::decimal > 0
               AND (ABS(balance)::float / (metadata->>'credit_limit')::decimal) >= $2
             ORDER BY utilization DESC`,
            [userId, threshold]
        );
        return result.rows;
    }

    /**
     * Get upcoming EMIs
     */
    static async getUpcomingEMIs(userId: string, daysAhead: number = 7): Promise<any[]> {
        const result = await query(
            `SELECT id, loan_name, emi_amount, next_emi_date
             FROM loans
             WHERE user_id = $1 
               AND status = 'active'
               AND next_emi_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + $2 * INTERVAL '1 day')
             ORDER BY next_emi_date`,
            [userId, daysAhead]
        );
        return result.rows;
    }

    /**
     * Get cashflow data for multiple months
     */
    static async getCashflowByMonth(userId: string, startDate: string, endDate: string): Promise<any[]> {
        const result = await query(
            `SELECT 
                TO_CHAR(transaction_date, 'YYYY-MM') as month,
                SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) as expenses
             FROM transactions
             WHERE user_id = $1 
               AND transaction_date BETWEEN $2 AND $3
             GROUP BY TO_CHAR(transaction_date, 'YYYY-MM')
             ORDER BY month`,
            [userId, startDate, endDate]
        );
        return result.rows;
    }

    /**
     * Get recent transactions
     */
    static async getRecentTransactions(userId: string, limit: number = 10): Promise<any[]> {
        const result = await query(
            `SELECT 
                t.id, t.transaction_date, t.merchant_normalized, t.category, 
                t.amount, t.direction, t.transaction_type,
                i.name as instrument_name, i.type as instrument_type
             FROM transactions t
             LEFT JOIN instruments i ON t.instrument_id = i.id
             WHERE t.user_id = $1
             ORDER BY t.transaction_date DESC, t.created_at DESC
             LIMIT $2`,
            [userId, limit]
        );
        return result.rows;
    }

    /**
     * Get budget usage for current month
     */
    static async getBudgetUsage(userId: string, month: number, year: number): Promise<any[]> {
        const result = await query(
            `SELECT 
                be.category_id,
                c.name as category_name,
                be.allocated_amount as budget_limit,
                COALESCE((
                    SELECT SUM(amount) FROM transactions 
                    WHERE user_id = $1 
                      AND category = c.name 
                      AND direction = 'debit'
                      AND EXTRACT(MONTH FROM transaction_date) = $2
                      AND EXTRACT(YEAR FROM transaction_date) = $3
                ), 0) as spent
             FROM budget_envelopes be
             JOIN categories c ON be.category_id = c.id
             WHERE be.user_id = $1 AND be.month = $2 AND be.year = $3
             ORDER BY be.allocated_amount DESC`,
            [userId, month, year]
        );
        return result.rows;
    }

    /**
     * Get goals progress
     */
    static async getGoalsProgress(userId: string, limit: number = 5): Promise<any[]> {
        const result = await query(
            `SELECT id, goal_name, goal_type, target_amount, current_amount, 
                    progress_percent, target_date, status, color, icon
             FROM goals
             WHERE user_id = $1 AND status = 'active'
             ORDER BY progress_percent DESC, target_date ASC NULLS LAST
             LIMIT $2`,
            [userId, limit]
        );
        return result.rows;
    }

    /**
     * Get top spending categories
     */
    static async getTopSpendingCategories(userId: string, month: number, year: number, limit: number = 5): Promise<any[]> {
        const result = await query(
            `SELECT category, SUM(amount) as total
             FROM transactions
             WHERE user_id = $1 
               AND direction = 'debit'
               AND EXTRACT(MONTH FROM transaction_date) = $2
               AND EXTRACT(YEAR FROM transaction_date) = $3
             GROUP BY category
             ORDER BY total DESC
             LIMIT $4`,
            [userId, month, year, limit]
        );
        return result.rows;
    }

    /**
     * Get spending comparison (current vs previous month)
     */
    static async getSpendingComparison(userId: string, month: number, year: number): Promise<{ current: number; previous: number }> {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;

        const result = await query(
            `SELECT 
                (SELECT COALESCE(SUM(amount), 0) FROM transactions 
                 WHERE user_id = $1 AND direction = 'debit'
                   AND EXTRACT(MONTH FROM transaction_date) = $2
                   AND EXTRACT(YEAR FROM transaction_date) = $3) as current,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions 
                 WHERE user_id = $1 AND direction = 'debit'
                   AND EXTRACT(MONTH FROM transaction_date) = $4
                   AND EXTRACT(YEAR FROM transaction_date) = $5) as previous`,
            [userId, month, year, prevMonth, prevYear]
        );
        return {
            current: parseFloat(result.rows[0]?.current) || 0,
            previous: parseFloat(result.rows[0]?.previous) || 0,
        };
    }

    /**
     * Save dashboard snapshot
     */
    static async saveSnapshot(userId: string, snapshotDate: string, type: string, data: any): Promise<void> {
        await query(
            `INSERT INTO dashboard_snapshots (user_id, snapshot_date, type, data, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (user_id, snapshot_date, type) 
             DO UPDATE SET data = $4, updated_at = NOW()`,
            [userId, snapshotDate, type, JSON.stringify(data)]
        );
    }
}
