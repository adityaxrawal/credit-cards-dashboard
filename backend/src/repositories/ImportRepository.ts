/**
 * Import Repository
 * Data access layer for CSV/OFX/QIF import operations
 */

import pool, { query } from '../lib/db';

export class ImportRepository {
    /**
     * Save or update import template
     */
    static async upsertTemplate(userId: string, template: {
        id?: string;
        templateName: string;
        source: string;
        dateColumn?: string;
        amountColumn?: string;
        descriptionColumn?: string;
        merchantColumn?: string;
        categoryColumn?: string;
        directionColumn?: string;
        dateFormat?: string;
        columnMapping?: Record<string, string>;
    }): Promise<any> {
        if (template.id) {
            const result = await query(
                `UPDATE import_templates SET 
                    template_name = $2, source = $3, date_column = $4, amount_column = $5,
                    description_column = $6, merchant_column = $7, category_column = $8,
                    direction_column = $9, date_format = $10, column_mapping = $11, updated_at = NOW()
                 WHERE id = $1 AND user_id = $12
                 RETURNING *`,
                [
                    template.id, template.templateName, template.source, template.dateColumn,
                    template.amountColumn, template.descriptionColumn, template.merchantColumn,
                    template.categoryColumn, template.directionColumn, template.dateFormat,
                    JSON.stringify(template.columnMapping || {}), userId,
                ]
            );
            return result.rows[0];
        } else {
            const result = await query(
                `INSERT INTO import_templates (
                    user_id, template_name, source, date_column, amount_column,
                    description_column, merchant_column, category_column, direction_column,
                    date_format, column_mapping, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
                RETURNING *`,
                [
                    userId, template.templateName, template.source, template.dateColumn,
                    template.amountColumn, template.descriptionColumn, template.merchantColumn,
                    template.categoryColumn, template.directionColumn, template.dateFormat,
                    JSON.stringify(template.columnMapping || {}),
                ]
            );
            return result.rows[0];
        }
    }

    /**
     * Get user templates
     */
    static async getTemplates(userId: string): Promise<any[]> {
        const result = await query(
            `SELECT * FROM import_templates WHERE user_id = $1 ORDER BY template_name`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Create import job
     */
    static async createJob(userId: string, fileName: string, templateId?: string): Promise<any> {
        const result = await query(
            `INSERT INTO import_jobs (
                user_id, template_id, file_name, status, total_rows, processed_rows,
                imported_rows, skipped_rows, duplicate_rows, error_rows, created_at
            ) VALUES ($1, $2, $3, 'pending', 0, 0, 0, 0, 0, 0, NOW())
            RETURNING *`,
            [userId, templateId, fileName]
        );
        return result.rows[0];
    }

    /**
     * Update import job
     */
    static async updateJob(jobId: string, update: Partial<{
        status: string;
        totalRows: number;
        processedRows: number;
        importedRows: number;
        skippedRows: number;
        duplicateRows: number;
        errorRows: number;
        errors: any[];
    }>): Promise<void> {
        const sets: string[] = [];
        const params: any[] = [jobId];
        let idx = 2;

        if (update.status) { sets.push(`status = $${idx++}`); params.push(update.status); }
        if (update.totalRows !== undefined) { sets.push(`total_rows = $${idx++}`); params.push(update.totalRows); }
        if (update.processedRows !== undefined) { sets.push(`processed_rows = $${idx++}`); params.push(update.processedRows); }
        if (update.importedRows !== undefined) { sets.push(`imported_rows = $${idx++}`); params.push(update.importedRows); }
        if (update.skippedRows !== undefined) { sets.push(`skipped_rows = $${idx++}`); params.push(update.skippedRows); }
        if (update.duplicateRows !== undefined) { sets.push(`duplicate_rows = $${idx++}`); params.push(update.duplicateRows); }
        if (update.errorRows !== undefined) { sets.push(`error_rows = $${idx++}`); params.push(update.errorRows); }
        if (update.errors !== undefined) { sets.push(`errors = $${idx++}`); params.push(JSON.stringify(update.errors)); }

        if (update.status === 'completed' || update.status === 'failed') {
            sets.push(`completed_at = NOW()`);
        }

        await query(`UPDATE import_jobs SET ${sets.join(', ')} WHERE id = $1`, params);
    }

    /**
     * Get import history
     */
    static async getImportHistory(userId: string, limit: number): Promise<any[]> {
        const result = await query(
            `SELECT * FROM import_jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
            [userId, limit]
        );
        return result.rows;
    }

    /**
     * Bulk insert transactions
     */
    static async bulkInsertTransactions(
        userId: string,
        instrumentId: string,
        transactions: Array<{
            date: string;
            amount: number;
            description: string;
            merchant?: string;
            category?: string;
            direction: string;
        }>,
        skipDuplicates: boolean = true
    ): Promise<{ imported: number; duplicates: number }> {
        const client = await pool.connect();
        let imported = 0;
        let duplicates = 0;

        try {
            await client.query('BEGIN');

            for (const txn of transactions) {
                // Check for duplicate
                if (skipDuplicates) {
                    const dupCheck = await client.query(
                        `SELECT id FROM transactions 
                         WHERE user_id = $1 AND instrument_id = $2 AND transaction_date = $3 
                           AND amount = $4 AND direction = $5
                         LIMIT 1`,
                        [userId, instrumentId, txn.date, txn.amount, txn.direction]
                    );
                    if (dupCheck.rows.length > 0) {
                        duplicates++;
                        continue;
                    }
                }

                await client.query(
                    `INSERT INTO transactions (
                        user_id, instrument_id, transaction_date, amount, direction,
                        description, merchant_normalized, category, source, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'import', NOW())`,
                    [
                        userId, instrumentId, txn.date, txn.amount, txn.direction,
                        txn.description, txn.merchant, txn.category || 'Uncategorized',
                    ]
                );
                imported++;
            }

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        return { imported, duplicates };
    }
}
