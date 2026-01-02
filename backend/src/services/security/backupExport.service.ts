import { BackupExportRepository } from '../../repositories/BackupExportRepository';
import { AuditTrailRepository } from '../../repositories/AuditTrailRepository';
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
            const accounts = await BackupExportRepository.getAccounts(userId);
            exportData.accounts = accounts;
            stats.accounts = accounts.length;
        }

        // Export transactions
        if (options.includeTransactions !== false) {
            const transactions = await BackupExportRepository.getTransactions(userId, options.dateRange);
            exportData.transactions = transactions;
            stats.transactions = transactions.length;
        }

        // Export loans
        if (options.includeLoans !== false) {
            const { loans, payments } = await BackupExportRepository.getLoans(userId);
            exportData.loans = loans;
            exportData.loanPayments = payments;
            stats.loans = loans.length;
        }

        // Export goals
        if (options.includeGoals !== false) {
            const { goals, contributions } = await BackupExportRepository.getGoals(userId);
            exportData.goals = goals;
            exportData.goalContributions = contributions;
            stats.goals = goals.length;
        }

        // Export bills
        if (options.includeBills !== false) {
            const bills = await BackupExportRepository.getBills(userId);
            exportData.bills = bills;
        }

        // Export recurring transactions
        if (options.includeRecurring !== false) {
            const recurring = await BackupExportRepository.getRecurringPatterns(userId);
            exportData.recurring = recurring;
        }

        // Export categories
        if (options.includeCategories !== false) {
            const categories = await BackupExportRepository.getCategories(userId);
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
        await AuditTrailRepository.create({
            userId,
            action: 'user:export',
            changes: {
                encrypted,
                stats,
                dateRange: options.dateRange,
                checksum
            }
        });

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

        try {
            // Import transactions
            if (exportData.transactions) {
                imported.transactions = await BackupExportRepository.importTransactions(userId, exportData.transactions);
            }

            // Import accounts
            if (exportData.accounts) {
                imported.accounts = await BackupExportRepository.importAccounts(userId, exportData.accounts);
            }

            // Log the import
            await AuditTrailRepository.create({
                userId,
                action: 'user:import',
                changes: { imported, errorCount: errors.length }
            });

            return { success: true, imported, errors };
        } catch (error: any) {
            return { success: false, imported, errors: [{ error: error.message }] };
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

        // Store backup metadata
        await BackupExportRepository.createBackupRecord(userId, backupId, `/backups/${backupId}.json`);

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
