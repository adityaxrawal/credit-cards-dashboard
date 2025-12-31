import pool from '../../lib/db';
import { format, parse, isValid } from 'date-fns';

export interface ImportTemplate {
    id: string;
    userId: string;
    templateName: string;
    source: string;
    dateColumn?: string;
    amountColumn?: string;
    descriptionColumn?: string;
    merchantColumn?: string;
    categoryColumn?: string;
    directionColumn?: string;
    dateFormat?: string;
    columnMapping: Record<string, string>;
    createdAt: Date;
}

export interface ImportJob {
    id: string;
    userId: string;
    templateId?: string;
    fileName: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    totalRows: number;
    processedRows: number;
    importedRows: number;
    skippedRows: number;
    duplicateRows: number;
    errorRows: number;
    errors?: any[];
    createdAt: Date;
    completedAt?: Date;
}

export interface ParsedTransaction {
    date: string;
    amount: number;
    description: string;
    merchant?: string;
    category?: string;
    direction: 'credit' | 'debit';
    originalRow: any;
    rowIndex: number;
}

export class ImportService {
    /**
     * Create or update import template
     */
    async saveTemplate(userId: string, template: Partial<ImportTemplate>): Promise<ImportTemplate> {
        const query = template.id
            ? `UPDATE import_templates SET 
          template_name = $2, source = $3, date_column = $4, amount_column = $5,
          description_column = $6, merchant_column = $7, category_column = $8,
          direction_column = $9, date_format = $10, column_mapping = $11
         WHERE id = $1 AND user_id = $12 RETURNING *`
            : `INSERT INTO import_templates (
          user_id, template_name, source, date_column, amount_column,
          description_column, merchant_column, category_column,
          direction_column, date_format, column_mapping
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`;

        const values = template.id
            ? [
                template.id, template.templateName, template.source, template.dateColumn,
                template.amountColumn, template.descriptionColumn, template.merchantColumn,
                template.categoryColumn, template.directionColumn, template.dateFormat,
                JSON.stringify(template.columnMapping || {}), userId
            ]
            : [
                userId, template.templateName, template.source, template.dateColumn,
                template.amountColumn, template.descriptionColumn, template.merchantColumn,
                template.categoryColumn, template.directionColumn, template.dateFormat,
                JSON.stringify(template.columnMapping || {})
            ];

        const result = await pool.query(query, values);
        return this.mapTemplateRow(result.rows[0]);
    }

    /**
     * Get user's templates
     */
    async getTemplates(userId: string): Promise<ImportTemplate[]> {
        const result = await pool.query(
            'SELECT * FROM import_templates WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        return result.rows.map(row => this.mapTemplateRow(row));
    }

    /**
     * Parse CSV content and return preview
     */
    /**
     * Parse CSV content and return preview
     */
    parseCSV(csvContent: string, hasHeader: boolean = true): { headers: string[]; rows: any[]; preview: any[] } {
        const lines = csvContent.trim().split('\n');
        if (lines.length === 0) {
            throw new Error('CSV file is empty');
        }

        const delimiter = this.detectDelimiter(lines[0]);
        // Handle potential BOM or garbage at start
        let firstLine = lines[0].trim();
        if (firstLine.charCodeAt(0) === 0xFEFF) {
            firstLine = firstLine.slice(1);
        }

        const headers = hasHeader ? this.parseLine(firstLine, delimiter) : [];
        const dataStartIndex = hasHeader ? 1 : 0;

        const rows: any[] = [];
        for (let i = dataStartIndex; i < lines.length; i++) {
            if (!lines[i].trim()) continue; // Skip empty lines
            const values = this.parseLine(lines[i], delimiter);
            if (hasHeader) {
                const row: Record<string, string> = {};
                headers.forEach((header, index) => {
                    const cleanHeader = header.replace(/^"|"$/g, '').trim();
                    if (cleanHeader) {
                        row[cleanHeader] = (values[index] || '').replace(/^"|"$/g, '').trim();
                    }
                });
                rows.push(row);
            } else {
                rows.push(values.map(v => v.replace(/^"|"$/g, '').trim()));
            }
        }

        return {
            headers,
            rows,
            preview: rows.slice(0, 10),
        };
    }

    /**
     * Parse OFX content (Basic SGML/XML parser)
     */
    parseOFX(content: string): { transactions: ParsedTransaction[]; errors: any[] } {
        const transactions: ParsedTransaction[] = [];
        const errors: any[] = [];
        let rowIndex = 0;

        try {
            // Very basic OFX parsing - extracting STMTTRN blocks
            const transactionBlocks = content.split('<STMTTRN>');

            for (let i = 1; i < transactionBlocks.length; i++) { // Skip preamble
                const block = transactionBlocks[i];
                rowIndex++;

                try {
                    const typeMatch = block.match(/<TRNTYPE>(.*?)(\r|\n|<)/);
                    const dateMatch = block.match(/<DTPOSTED>(.*?)(\r|\n|<)/);
                    const amountMatch = block.match(/<TRNAMT>(.*?)(\r|\n|<)/);
                    const nameMatch = block.match(/<NAME>(.*?)(\r|\n|<)/);
                    const memoMatch = block.match(/<MEMO>(.*?)(\r|\n|<)/);

                    if (!dateMatch || !amountMatch) continue;

                    const dateStr = dateMatch[1].trim(); // YYYYMMDD...
                    const amountStr = amountMatch[1].trim();
                    const name = nameMatch ? nameMatch[1].trim() : 'Unknown';
                    const memo = memoMatch ? memoMatch[1].trim() : '';

                    // Parse Date: YYYYMMDDHHMMSS
                    const year = parseInt(dateStr.substring(0, 4));
                    const month = parseInt(dateStr.substring(4, 6)) - 1;
                    const day = parseInt(dateStr.substring(6, 8));
                    const date = new Date(year, month, day);

                    const amount = parseFloat(amountStr);
                    const direction = amount < 0 ? 'debit' : 'credit';

                    transactions.push({
                        date: format(date, 'yyyy-MM-dd'),
                        amount: Math.abs(amount),
                        description: memo ? `${name} - ${memo}` : name,
                        merchant: name,
                        direction,
                        originalRow: { raw: block.substring(0, 100) + '...' },
                        rowIndex
                    });
                } catch (e: any) {
                    errors.push({ rowIndex, error: e.message });
                }
            }
        } catch (e: any) {
            errors.push({ rowIndex: 0, error: 'Failed to parse OFX: ' + e.message });
        }

        return { transactions, errors };
    }

    /**
     * Parse QIF content
     */
    parseQIF(content: string): { transactions: ParsedTransaction[]; errors: any[] } {
        const transactions: ParsedTransaction[] = [];
        const errors: any[] = [];

        const chunks = content.split('^'); // End of record character
        let rowIndex = 0;

        for (const chunk of chunks) {
            if (!chunk.trim()) continue;
            rowIndex++;

            const lines = chunk.trim().split('\n');
            let date: Date | null = null;
            let amount = 0;
            let payee = '';
            let memo = '';
            let category = '';

            try {
                for (const line of lines) {
                    const type = line.charAt(0);
                    const data = line.substring(1).trim();

                    if (type === 'D') { // Date
                        // Handle D12/31/2023 or D12/31/23
                        date = new Date(data);
                        if (isNaN(date.getTime())) {
                            // Try generic parsing if default fails
                            // Assuming MM/DD/YYYY or DD/MM/YYYY based on locale?
                            // Let's assume standard QIF MM/DD/YY or YYYY
                            /* Simplified fallback */
                        }
                    } else if (type === 'T') { // Amount
                        amount = parseFloat(data.replace(/,/g, ''));
                    } else if (type === 'P') { // Payee
                        payee = data;
                    } else if (type === 'M') { // Memo
                        memo = data;
                    } else if (type === 'L') { // Category
                        category = data;
                    }
                }

                if (date && amount !== 0) {
                    transactions.push({
                        date: format(date, 'yyyy-MM-dd'),
                        amount: Math.abs(amount),
                        description: memo ? `${payee} - ${memo}` : payee,
                        merchant: payee,
                        category: category,
                        direction: amount < 0 ? 'debit' : 'credit', // QIF typically uses negative for debit
                        originalRow: { raw: chunk.substring(0, 50) + '...' },
                        rowIndex
                    });
                }
            } catch (e: any) {
                errors.push({ rowIndex, error: e.message });
            }
        }

        return { transactions, errors };
    }

    /**
     * Preview import with mapping applied
     */
    previewImport(
        rows: any[],
        mapping: {
            dateColumn: string;
            amountColumn: string;
            descriptionColumn: string;
            merchantColumn?: string;
            categoryColumn?: string;
            directionColumn?: string;
            dateFormat?: string;
        }
    ): { transactions: ParsedTransaction[]; errors: any[] } {
        const transactions: ParsedTransaction[] = [];
        const errors: any[] = [];

        rows.forEach((row, index) => {
            try {
                const dateValue = row[mapping.dateColumn];
                const amountValue = row[mapping.amountColumn];
                const description = row[mapping.descriptionColumn] || '';

                // Parse date
                let parsedDate: Date;
                if (mapping.dateFormat) {
                    parsedDate = parse(dateValue, mapping.dateFormat, new Date());
                } else {
                    parsedDate = new Date(dateValue);
                }

                if (!isValid(parsedDate)) {
                    throw new Error(`Invalid date: ${dateValue}`);
                }

                // Parse amount
                const amount = this.parseAmount(amountValue);
                if (isNaN(amount) || amount === 0) {
                    throw new Error(`Invalid amount: ${amountValue}`);
                }

                // Determine direction
                let direction: 'credit' | 'debit' = 'debit';
                if (mapping.directionColumn && row[mapping.directionColumn]) {
                    const dirValue = row[mapping.directionColumn].toLowerCase();
                    direction = dirValue.includes('cr') || dirValue.includes('credit') ? 'credit' : 'debit';
                } else if (amount > 0 && amountValue.toString().includes('-')) {
                    direction = 'debit';
                } else if (amount < 0) {
                    direction = 'debit';
                }

                transactions.push({
                    date: format(parsedDate, 'yyyy-MM-dd'),
                    amount: Math.abs(amount),
                    description,
                    merchant: mapping.merchantColumn ? row[mapping.merchantColumn] : undefined,
                    category: mapping.categoryColumn ? row[mapping.categoryColumn] : undefined,
                    direction,
                    originalRow: row,
                    rowIndex: index,
                });
            } catch (error: any) {
                errors.push({
                    rowIndex: index,
                    row,
                    error: error.message,
                });
            }
        });

        return { transactions, errors };
    }

    /**
     * Execute import job
     */
    async executeImport(
        userId: string,
        instrumentId: string,
        transactions: ParsedTransaction[],
        options: { skipDuplicates?: boolean } = {}
    ): Promise<ImportJob> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create import job
            const jobResult = await client.query(
                `INSERT INTO import_jobs (
          user_id, file_name, status, total_rows, processed_rows, 
          imported_rows, skipped_rows, duplicate_rows, error_rows
        ) VALUES ($1, 'manual_import', 'processing', $2, 0, 0, 0, 0, 0)
        RETURNING *`,
                [userId, transactions.length]
            );

            const jobId = jobResult.rows[0].id;
            let importedRows = 0;
            let duplicateRows = 0;
            let errorRows = 0;
            const errors: any[] = [];

            for (const txn of transactions) {
                try {
                    // Check for duplicates
                    if (options.skipDuplicates) {
                        const dupCheck = await client.query(
                            `SELECT id FROM transactions 
               WHERE user_id = $1 AND instrument_id = $2 
               AND amount = $3 AND transaction_date = $4
               AND description = $5 LIMIT 1`,
                            [userId, instrumentId, txn.amount, txn.date, txn.description]
                        );

                        if (dupCheck.rows.length > 0) {
                            duplicateRows++;
                            continue;
                        }
                    }

                    // Insert transaction
                    await client.query(
                        `INSERT INTO transactions (
              user_id, instrument_id, amount, direction, 
              description, transaction_date, category, type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual')`,
                        [
                            userId, instrumentId, txn.amount, txn.direction,
                            txn.description, txn.date, txn.category || 'Uncategorized'
                        ]
                    );

                    importedRows++;
                } catch (error: any) {
                    errorRows++;
                    errors.push({
                        rowIndex: txn.rowIndex,
                        error: error.message,
                    });
                }
            }

            // Update job status
            await client.query(
                `UPDATE import_jobs SET 
          status = 'completed', processed_rows = $2, imported_rows = $3,
          duplicate_rows = $4, error_rows = $5, errors = $6, completed_at = NOW()
         WHERE id = $1`,
                [jobId, transactions.length, importedRows, duplicateRows, errorRows, JSON.stringify(errors)]
            );

            await client.query('COMMIT');

            return {
                id: jobId,
                userId,
                fileName: 'manual_import',
                status: 'completed',
                totalRows: transactions.length,
                processedRows: transactions.length,
                importedRows,
                skippedRows: 0,
                duplicateRows,
                errorRows,
                errors,
                createdAt: new Date(),
                completedAt: new Date(),
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get import history
     */
    async getImportHistory(userId: string, limit: number = 20): Promise<ImportJob[]> {
        const result = await pool.query(
            'SELECT * FROM import_jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
            [userId, limit]
        );
        return result.rows.map(row => this.mapJobRow(row));
    }

    private detectDelimiter(line: string): string {
        const delimiters = [',', ';', '\t', '|'];
        let maxCount = 0;
        let bestDelimiter = ',';

        for (const d of delimiters) {
            const count = (line.match(new RegExp(`\\${d}`, 'g')) || []).length;
            if (count > maxCount) {
                maxCount = count;
                bestDelimiter = d;
            }
        }

        return bestDelimiter;
    }

    private parseLine(line: string, delimiter: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());

        return result;
    }

    private parseAmount(value: string): number {
        if (typeof value !== 'string') value = String(value);
        // Remove currency symbols and commas
        const cleaned = value.replace(/[₹$€£,\s]/g, '');
        return parseFloat(cleaned);
    }

    private mapTemplateRow(row: any): ImportTemplate {
        return {
            id: row.id,
            userId: row.user_id,
            templateName: row.template_name,
            source: row.source,
            dateColumn: row.date_column,
            amountColumn: row.amount_column,
            descriptionColumn: row.description_column,
            merchantColumn: row.merchant_column,
            categoryColumn: row.category_column,
            directionColumn: row.direction_column,
            dateFormat: row.date_format,
            columnMapping: row.column_mapping || {},
            createdAt: row.created_at,
        };
    }

    private mapJobRow(row: any): ImportJob {
        return {
            id: row.id,
            userId: row.user_id,
            templateId: row.template_id,
            fileName: row.file_name,
            status: row.status,
            totalRows: row.total_rows,
            processedRows: row.processed_rows,
            importedRows: row.imported_rows,
            skippedRows: row.skipped_rows,
            duplicateRows: row.duplicate_rows,
            errorRows: row.error_rows,
            errors: row.errors,
            createdAt: row.created_at,
            completedAt: row.completed_at,
        };
    }
}
