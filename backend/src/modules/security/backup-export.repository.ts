/**
 * Backup Export Repository
 * Data access layer for backup and export operations
 */

import pool, { query } from '@shared/database/db';

export class BackupExportRepository {
    /**
     * Get user profile for export
     */
    static async getUserProfile(userId: string): Promise<any> {
        const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
        if (result.rows[0]) {
            const user = { ...result.rows[0] };
            delete user.password_hash;
            return user;
        }
        return null;
    }

    /**
     * Get transactions for export
     */
    static async getTransactions(userId: string, dateRange?: { start: string; end: string }): Promise<any[]> {
        let sql = 'SELECT * FROM transactions WHERE user_id = $1';
        const params: any[] = [userId];

        if (dateRange) {
            sql += ' AND transaction_date BETWEEN $2 AND $3';
            params.push(dateRange.start, dateRange.end);
        }

        sql += ' ORDER BY transaction_date DESC';
        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Get accounts for export
     */
    static async getAccounts(userId: string): Promise<any[]> {
        const result = await query(
            'SELECT * FROM instruments WHERE user_id = $1',
            [userId]
        );
        return result.rows;
    }

    /**
     * Get loans for export
     */
    static async getLoans(userId: string): Promise<{ loans: any[]; payments: any[] }> {
        const loansResult = await query('SELECT * FROM loans WHERE user_id = $1', [userId]);
        const paymentsResult = await query('SELECT * FROM loan_payments WHERE user_id = $1', [userId]);
        return { loans: loansResult.rows, payments: paymentsResult.rows };
    }

    /**
     * Get goals for export
     */
    static async getGoals(userId: string): Promise<{ goals: any[]; contributions: any[] }> {
        const goalsResult = await query('SELECT * FROM goals WHERE user_id = $1', [userId]);
        const contributionsResult = await query('SELECT * FROM goal_contributions WHERE user_id = $1', [userId]);
        return { goals: goalsResult.rows, contributions: contributionsResult.rows };
    }

    /**
     * Get bills for export
     */
    static async getBills(userId: string): Promise<any[]> {
        const result = await query('SELECT * FROM bills WHERE user_id = $1', [userId]);
        return result.rows;
    }

    /**
     * Get recurring patterns for export
     */
    static async getRecurringPatterns(userId: string): Promise<any[]> {
        const result = await query('SELECT * FROM recurring_patterns WHERE user_id = $1', [userId]);
        return result.rows;
    }

    /**
     * Get categories for export
     */
    static async getCategories(userId: string): Promise<any[]> {
        const result = await query(
            'SELECT * FROM categories WHERE user_id = $1 OR user_id IS NULL',
            [userId]
        );
        return result.rows;
    }

    /**
     * Create backup record
     */
    static async createBackupRecord(userId: string, backupId: string, path: string): Promise<void> {
        await query(
            `INSERT INTO user_backups (id, user_id, file_path, created_at, status)
             VALUES ($1, $2, $3, NOW(), 'completed')`,
            [backupId, userId, path]
        );
    }

    /**
     * Import transactions (bulk insert)
     */
    static async importTransactions(userId: string, transactions: any[]): Promise<number> {
        if (transactions.length === 0) return 0;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            let count = 0;
            for (const t of transactions) {
                await client.query(
                    `INSERT INTO transactions (user_id, transaction_date, amount, direction, category, merchant_normalized, description)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     ON CONFLICT DO NOTHING`,
                    [userId, t.transaction_date, t.amount, t.direction, t.category, t.merchant_normalized, t.description]
                );
                count++;
            }
            await client.query('COMMIT');
            return count;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Import accounts (bulk insert)
     */
    static async importAccounts(userId: string, accounts: any[]): Promise<number> {
        if (accounts.length === 0) return 0;

        let count = 0;
        for (const a of accounts) {
            await query(
                `INSERT INTO instruments (user_id, type, name, balance, status)
                 VALUES ($1, $2, $3, $4, 'active')
                 ON CONFLICT DO NOTHING`,
                [userId, a.type, a.name, a.balance]
            );
            count++;
        }
        return count;
    }
}
