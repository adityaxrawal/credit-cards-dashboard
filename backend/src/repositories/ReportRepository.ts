/**
 * Report Repository
 * Data access layer for report/export operations
 */

import { query } from '../lib/db';

export class ReportRepository {
    /**
     * Get transactions for export
     */
    static async getTransactionsForExport(
        userId: string,
        filters: {
            from?: Date;
            to?: Date;
            category?: string;
            instrumentType?: string;
            instrumentId?: string;
            merchant?: string;
        }
    ): Promise<any[]> {
        let sql = `
            SELECT t.*, i.name as instrument_name, i.type as instrument_type
            FROM transactions t
            LEFT JOIN instruments i ON t.instrument_id = i.id
            WHERE t.user_id = $1
        `;
        const params: any[] = [userId];
        let idx = 2;

        if (filters.from) {
            sql += ` AND t.transaction_date >= $${idx++}`;
            params.push(filters.from);
        }
        if (filters.to) {
            sql += ` AND t.transaction_date <= $${idx++}`;
            params.push(filters.to);
        }
        if (filters.category) {
            sql += ` AND t.category = $${idx++}`;
            params.push(filters.category);
        }
        if (filters.instrumentType) {
            sql += ` AND i.type = $${idx++}`;
            params.push(filters.instrumentType);
        }
        if (filters.instrumentId) {
            sql += ` AND t.instrument_id = $${idx++}`;
            params.push(filters.instrumentId);
        }
        if (filters.merchant) {
            sql += ` AND t.merchant_normalized ILIKE $${idx++}`;
            params.push(`%${filters.merchant}%`);
        }

        sql += ` ORDER BY t.transaction_date DESC`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Get monthly summary
     */
    static async getMonthlySummary(userId: string, month: number, year: number): Promise<any> {
        const result = await query(
            `SELECT 
                SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) as total_income,
                SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) as total_expenses,
                COUNT(*) as transaction_count
             FROM transactions
             WHERE user_id = $1 
               AND EXTRACT(MONTH FROM transaction_date) = $2
               AND EXTRACT(YEAR FROM transaction_date) = $3`,
            [userId, month, year]
        );
        return result.rows[0];
    }

    /**
     * Get category breakdown
     */
    static async getCategoryBreakdown(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
        const result = await query(
            `SELECT 
                category,
                SUM(amount) as total,
                COUNT(*) as count
             FROM transactions
             WHERE user_id = $1 
               AND transaction_date BETWEEN $2 AND $3
               AND direction = 'debit'
             GROUP BY category
             ORDER BY total DESC`,
            [userId, startDate, endDate]
        );
        return result.rows;
    }

    /**
     * Get export stats
     */
    static async getExportStats(userId: string): Promise<any> {
        const result = await query(
            `SELECT 
                COUNT(*) as total_transactions,
                MIN(transaction_date) as earliest_transaction,
                MAX(transaction_date) as latest_transaction,
                COUNT(DISTINCT category) as category_count,
                COUNT(DISTINCT merchant_normalized) as merchant_count
             FROM transactions
             WHERE user_id = $1`,
            [userId]
        );
        return result.rows[0];
    }

    /**
     * Get yearly summary
     */
    static async getYearlySummary(userId: string, year: number): Promise<any[]> {
        const result = await query(
            `SELECT 
                EXTRACT(MONTH FROM transaction_date) as month,
                SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) as expenses
             FROM transactions
             WHERE user_id = $1 
               AND EXTRACT(YEAR FROM transaction_date) = $2
             GROUP BY EXTRACT(MONTH FROM transaction_date)
             ORDER BY month`,
            [userId, year]
        );
        return result.rows;
    }
    /**
     * Get top merchants by spending
     */
    static async getTopMerchants(userId: string, from: Date, to: Date, limit: number = 5): Promise<any[]> {
        const result = await query(
            `SELECT merchant, SUM(amount) as total, COUNT(*) as count 
             FROM transactions 
             WHERE user_id = $1 AND transaction_date >= $2 AND transaction_date <= $3
             GROUP BY merchant 
             ORDER BY total DESC 
             LIMIT $4`,
            [userId, from, to, limit]
        );
        return result.rows;
    }

    /**
     * Get large transactions
     */
    static async getLargeTransactions(userId: string, from: Date, amountThreshold: number, limit: number = 3): Promise<any[]> {
        const result = await query(
            `SELECT merchant, amount, transaction_date
             FROM transactions 
             WHERE user_id = $1 AND transaction_date >= $2 AND amount > $3
             ORDER BY transaction_date DESC 
             LIMIT $4`,
            [userId, from, amountThreshold, limit]
        );
        return result.rows;
    }
}
