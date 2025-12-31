import pool from '../../lib/db';
import crypto from 'crypto';
import dayjs from 'dayjs';

/**
 * Backup & Export Service
 * Provides encrypted backup and export functionality for user data
 */

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

export interface ExportOptions {
    includeTransactions?: boolean;
    includeAccounts?: boolean;
    includeLoans?: boolean;
    includeGoals?: boolean;
    includeBills?: boolean;
    includeRecurring?: boolean;
    includeCategories?: boolean;
    dateRange?: { start: string; end: string };
    encrypt?: boolean;
    password?: string;
}

export interface ExportResult {
    data: string;
    encrypted: boolean;
    format: 'json' | 'csv';
    createdAt: string;
    checksum: string;
    stats: {
        transactions: number;
        accounts: number;
        loans: number;
        goals: number;
    };
}

export class BackupExportService {
    /**
     * Generate a full data export
     */
    async exportUserData(userId: string, options: ExportOptions = {}): Promise<ExportResult> {
        const exportData: any = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            userId,
        };

        const stats = {
            transactions: 0,
            accounts: 0,
            loans: 0,
            goals: 0,
        };

        // Export accounts/instruments
        if (options.includeAccounts !== false) {
            const { rows: accounts } = await pool.query(
                `SELECT * FROM instruments WHERE user_id = $1 AND deleted_at IS NULL`,
                [userId]
            );
            exportData.accounts = accounts;
            stats.accounts = accounts.length;
        }

        // Export transactions
        if (options.includeTransactions !== false) {
            let txnQuery = `SELECT * FROM transactions WHERE user_id = $1`;
            const params: any[] = [userId];

            if (options.dateRange) {
                txnQuery += ` AND transaction_date BETWEEN $2 AND $3`;
                params.push(options.dateRange.start, options.dateRange.end);
            }

            txnQuery += ` ORDER BY transaction_date DESC`;

            const { rows: transactions } = await pool.query(txnQuery, params);
            exportData.transactions = transactions;
            stats.transactions = transactions.length;
        }

        // Export loans
        if (options.includeLoans !== false) {
            const { rows: loans } = await pool.query(
                `SELECT * FROM loans WHERE user_id = $1 AND deleted_at IS NULL`,
                [userId]
            );

            const { rows: payments } = await pool.query(
                `SELECT lp.* FROM loan_payments lp
         JOIN loans l ON lp.loan_id = l.id
         WHERE l.user_id = $1`,
                [userId]
            );

            exportData.loans = loans;
            exportData.loanPayments = payments;
            stats.loans = loans.length;
        }

        // Export goals
        if (options.includeGoals !== false) {
            const { rows: goals } = await pool.query(
                `SELECT * FROM goals WHERE user_id = $1 AND deleted_at IS NULL`,
                [userId]
            );

            const { rows: contributions } = await pool.query(
                `SELECT gc.* FROM goal_contributions gc
         JOIN goals g ON gc.goal_id = g.id
         WHERE g.user_id = $1`,
                [userId]
            );

            exportData.goals = goals;
            exportData.goalContributions = contributions;
            stats.goals = goals.length;
        }

        // Export bills
        if (options.includeBills !== false) {
            const { rows: bills } = await pool.query(
                `SELECT * FROM bills WHERE user_id = $1`,
                [userId]
            );
            exportData.bills = bills;
        }

        // Export recurring transactions
        if (options.includeRecurring !== false) {
            const { rows: recurring } = await pool.query(
                `SELECT * FROM recurring_transactions WHERE user_id = $1`,
                [userId]
            );
            exportData.recurring = recurring;
        }

        // Export categories
        if (options.includeCategories !== false) {
            const { rows: categories } = await pool.query(
                `SELECT * FROM categories WHERE user_id = $1 OR user_id IS NULL`,
                [userId]
            );
            exportData.categories = categories;
        }

        // Convert to JSON
        let jsonData = JSON.stringify(exportData, null, 2);
        const checksum = this.generateChecksum(jsonData);

        // Encrypt if requested
        let encrypted = false;
        if (options.encrypt && options.password) {
            jsonData = this.encrypt(jsonData, options.password);
            encrypted = true;
        }

        // Log the export
        await pool.query(
            `INSERT INTO transaction_audit_log 
       (user_id, action, changes, changed_at)
       VALUES ($1, 'user:export', $2, NOW())`,
            [
                userId,
                JSON.stringify({
                    encrypted,
                    stats,
                    dateRange: options.dateRange,
                    checksum
                })
            ]
        );

        return {
            data: jsonData,
            encrypted,
            format: 'json',
            createdAt: new Date().toISOString(),
            checksum,
            stats,
        };
    }

    /**
     * Import data from backup
     */
    async importUserData(
        userId: string,
        data: string,
        options: {
            encrypted?: boolean;
            password?: string;
            overwrite?: boolean;
            dryRun?: boolean;
        } = {}
    ): Promise<{ success: boolean; imported: any; errors: any[] }> {
        let jsonData = data;

        // Decrypt if needed
        if (options.encrypted && options.password) {
            try {
                jsonData = this.decrypt(data, options.password);
            } catch (error) {
                return { success: false, imported: null, errors: [{ error: 'Decryption failed. Invalid password.' }] };
            }
        }

        let exportData: any;
        try {
            exportData = JSON.parse(jsonData);
        } catch (error) {
            return { success: false, imported: null, errors: [{ error: 'Invalid JSON format' }] };
        }

        const imported: any = {
            accounts: 0,
            transactions: 0,
            loans: 0,
            goals: 0,
        };
        const errors: any[] = [];

        if (options.dryRun) {
            // Just validate and count
            return {
                success: true,
                imported: {
                    accounts: exportData.accounts?.length || 0,
                    transactions: exportData.transactions?.length || 0,
                    loans: exportData.loans?.length || 0,
                    goals: exportData.goals?.length || 0,
                },
                errors: [],
            };
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Import accounts
            if (exportData.accounts) {
                for (const account of exportData.accounts) {
                    try {
                        await client.query(
                            `INSERT INTO instruments (id, user_id, name, type, balance, currency, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (id) DO UPDATE SET balance = $5`,
                            [account.id, userId, account.name, account.type, account.balance, account.currency, account.created_at]
                        );
                        imported.accounts++;
                    } catch (err: any) {
                        errors.push({ entity: 'account', id: account.id, error: err.message });
                    }
                }
            }

            // Import transactions
            if (exportData.transactions) {
                for (const txn of exportData.transactions) {
                    try {
                        await client.query(
                            `INSERT INTO transactions 
               (id, user_id, instrument_id, amount, direction, description, category, transaction_date, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (id) DO NOTHING`,
                            [
                                txn.id, userId, txn.instrument_id, txn.amount, txn.direction,
                                txn.description, txn.category, txn.transaction_date, txn.created_at
                            ]
                        );
                        imported.transactions++;
                    } catch (err: any) {
                        errors.push({ entity: 'transaction', id: txn.id, error: err.message });
                    }
                }
            }

            await client.query('COMMIT');

            // Log the import
            await pool.query(
                `INSERT INTO transaction_audit_log 
         (user_id, action, changes, changed_at)
         VALUES ($1, 'user:import', $2, NOW())`,
                [userId, JSON.stringify({ imported, errorCount: errors.length })]
            );

            return { success: true, imported, errors };
        } catch (error: any) {
            await client.query('ROLLBACK');
            return { success: false, imported, errors: [{ error: error.message }] };
        } finally {
            client.release();
        }
    }

    /**
     * Generate scheduled backup
     */
    async createScheduledBackup(userId: string): Promise<{ backupId: string; path: string }> {
        const exportResult = await this.exportUserData(userId, {
            encrypt: false, // Scheduled backups aren't user-password encrypted
        });

        const backupId = `backup_${userId}_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}`;

        // In production, this would upload to cloud storage
        // For now, we just store metadata in DB
        await pool.query(
            `INSERT INTO dashboard_snapshots 
       (user_id, snapshot_date, snapshot_type, data)
       VALUES ($1, $2, 'backup', $3)`,
            [
                userId,
                dayjs().format('YYYY-MM-DD'),
                JSON.stringify({
                    backupId,
                    stats: exportResult.stats,
                    checksum: exportResult.checksum,
                    createdAt: exportResult.createdAt,
                })
            ]
        );

        return { backupId, path: `/backups/${backupId}.json` };
    }

    /**
     * Encrypt data with password
     */
    private encrypt(data: string, password: string): string {
        const salt = crypto.randomBytes(SALT_LENGTH);
        const iv = crypto.randomBytes(IV_LENGTH);
        const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');

        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(data, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        const authTag = cipher.getAuthTag();

        // Combine salt + iv + authTag + encrypted data
        const combined = Buffer.concat([
            salt,
            iv,
            authTag,
            Buffer.from(encrypted, 'base64'),
        ]);

        return combined.toString('base64');
    }

    /**
     * Decrypt data with password
     */
    private decrypt(encryptedData: string, password: string): string {
        const combined = Buffer.from(encryptedData, 'base64');

        const salt = combined.subarray(0, SALT_LENGTH);
        const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
        const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

        const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted.toString('base64'), 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Generate checksum for data integrity
     */
    private generateChecksum(data: string): string {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
}

export const backupExportService = new BackupExportService();
