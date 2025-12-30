/**
 * Report Service - Export and report generation
 */

import * as transactionsQueries from '../../db/queries/transactions.queries';
import pool from '../../lib/db';
import dayjs from 'dayjs';

export interface ExportFilters {
    from?: Date;
    to?: Date;
    category?: string;
    instrumentType?: string;
    instrumentId?: string;
    merchant?: string;
}

export interface ExportResult {
    data: string | Buffer;
    filename: string;
    mimeType: string;
    rowCount: number;
}

export class ReportService {
    /**
     * Export transactions to CSV format
     */
    static async exportTransactionsCSV(
        userId: string,
        filters: ExportFilters = {}
    ): Promise<ExportResult> {
        const transactions = await this.fetchTransactionsForExport(userId, filters);

        // CSV header
        const headers = [
            'Date',
            'Merchant',
            'Category',
            'Amount',
            'Direction',
            'Type',
            'Instrument',
            'Description',
            'Reference',
        ];

        // CSV rows
        const rows = transactions.map(txn => [
            dayjs(txn.transaction_date).format('YYYY-MM-DD HH:mm:ss'),
            this.escapeCSV(txn.merchant || ''),
            this.escapeCSV(txn.category || ''),
            txn.amount,
            txn.direction || 'debit',
            txn.transaction_type || '',
            txn.instrument_type || '',
            this.escapeCSV(txn.description || ''),
            txn.reference_number || '',
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const dateRange = this.getDateRangeString(filters);

        return {
            data: csvContent,
            filename: `transactions_${dateRange}.csv`,
            mimeType: 'text/csv',
            rowCount: transactions.length,
        };
    }

    /**
     * Export transactions to Excel format (TSV for simplicity)
     * In production, you'd use a library like exceljs
     */
    static async exportTransactionsExcel(
        userId: string,
        filters: ExportFilters = {}
    ): Promise<ExportResult> {
        const transactions = await this.fetchTransactionsForExport(userId, filters);

        // For now, generate TSV which Excel understands
        const headers = [
            'Date',
            'Merchant',
            'Category',
            'Amount',
            'Direction',
            'Type',
            'Instrument',
            'Description',
            'Reference',
        ];

        const rows = transactions.map(txn => [
            dayjs(txn.transaction_date).format('YYYY-MM-DD HH:mm:ss'),
            txn.merchant || '',
            txn.category || '',
            txn.amount,
            txn.direction || 'debit',
            txn.transaction_type || '',
            txn.instrument_type || '',
            txn.description || '',
            txn.reference_number || '',
        ]);

        const tsvContent = [
            headers.join('\t'),
            ...rows.map(row => row.join('\t'))
        ].join('\n');

        const dateRange = this.getDateRangeString(filters);

        return {
            data: tsvContent,
            filename: `transactions_${dateRange}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            rowCount: transactions.length,
        };
    }

    /**
     * Generate monthly summary report
     */
    static async generateMonthlySummary(
        userId: string,
        month: number,
        year: number
    ) {
        const from = dayjs().year(year).month(month - 1).startOf('month').toDate();
        const to = dayjs().year(year).month(month - 1).endOf('month').toDate();

        const aggregations = await transactionsQueries.getSpendingAggregations(userId, {
            from,
            to,
        });

        // Get transaction count
        const countResult = await pool.query(
            `SELECT COUNT(*) as count FROM transactions 
       WHERE user_id = $1 AND transaction_date >= $2 AND transaction_date <= $3`,
            [userId, from, to]
        );

        return {
            month,
            year,
            totalSpent: aggregations.totalSpent,
            totalTransactions: parseInt(countResult.rows[0]?.count || '0'),
            byCategory: aggregations.byCategory,
            generatedAt: new Date(),
        };
    }

    /**
     * Generate monthly summary as PDF-ready HTML
     * In production, this would use a PDF library like puppeteer or pdfmake
     */
    static async generateMonthlySummaryPDF(
        userId: string,
        month: number,
        year: number
    ): Promise<ExportResult> {
        const summary = await this.generateMonthlySummary(userId, month, year);
        const monthName = dayjs().month(month - 1).format('MMMM');

        // Generate HTML that can be converted to PDF
        const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .summary-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .stat { display: inline-block; margin-right: 40px; }
        .stat-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .stat-label { color: #666; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f1f1f1; }
        .footer { margin-top: 40px; font-size: 12px; color: #999; }
    </style>
</head>
<body>
    <h1>Monthly Report: ${monthName} ${year}</h1>
    
    <div class="summary-box">
        <div class="stat">
            <div class="stat-value">₹${summary.totalSpent.toLocaleString('en-IN')}</div>
            <div class="stat-label">Total Spent</div>
        </div>
        <div class="stat">
            <div class="stat-value">${summary.totalTransactions}</div>
            <div class="stat-label">Transactions</div>
        </div>
    </div>
    
    <h2>Spending by Category</h2>
    <table>
        <tr><th>Category</th><th>Amount</th><th>Count</th><th>% of Total</th></tr>
        ${summary.byCategory.map(cat => `
        <tr>
            <td>${cat.category}</td>
            <td>₹${cat.total.toLocaleString('en-IN')}</td>
            <td>${cat.count}</td>
            <td>${((cat.total / summary.totalSpent) * 100).toFixed(1)}%</td>
        </tr>
        `).join('')}
    </table>
    
    <div class="footer">
        Generated on ${dayjs(summary.generatedAt).format('DD MMM YYYY HH:mm')}
    </div>
</body>
</html>`;

        return {
            data: html,
            filename: `monthly_report_${year}_${month.toString().padStart(2, '0')}.html`,
            mimeType: 'text/html',
            rowCount: summary.byCategory.length,
        };
    }

    /**
     * Generate category breakdown report as PDF-ready HTML
     */
    static async generateCategoryBreakdownPDF(
        userId: string,
        startDate: Date,
        endDate: Date
    ): Promise<ExportResult> {
        const aggregations = await transactionsQueries.getSpendingAggregations(userId, {
            from: startDate,
            to: endDate,
        });

        const dateRangeStr = `${dayjs(startDate).format('DD MMM YYYY')} - ${dayjs(endDate).format('DD MMM YYYY')}`;

        const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        h1 { color: #333; }
        .date-range { color: #666; margin-bottom: 20px; }
        .category-card { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #007bff; }
        .category-name { font-weight: bold; font-size: 16px; }
        .category-amount { font-size: 20px; color: #007bff; }
        .category-meta { color: #666; font-size: 12px; }
        .total-box { background: #007bff; color: white; padding: 20px; border-radius: 8px; margin-top: 30px; }
    </style>
</head>
<body>
    <h1>Category Breakdown Report</h1>
    <div class="date-range">${dateRangeStr}</div>
    
    ${aggregations.byCategory.map(cat => `
    <div class="category-card">
        <div class="category-name">${cat.category}</div>
        <div class="category-amount">₹${cat.total.toLocaleString('en-IN')}</div>
        <div class="category-meta">${cat.count} transactions | ${((cat.total / aggregations.totalSpent) * 100).toFixed(1)}% of total</div>
    </div>
    `).join('')}
    
    <div class="total-box">
        <strong>Total Spent:</strong> ₹${aggregations.totalSpent.toLocaleString('en-IN')}
    </div>
</body>
</html>`;

        return {
            data: html,
            filename: `category_breakdown_${dayjs(startDate).format('YYYYMMDD')}_${dayjs(endDate).format('YYYYMMDD')}.html`,
            mimeType: 'text/html',
            rowCount: aggregations.byCategory.length,
        };
    }

    /**
     * Get export statistics for a user
     */
    static async getExportStats(userId: string) {
        const result = await pool.query(
            `SELECT 
         COUNT(*) as total_transactions,
         MIN(transaction_date) as earliest_date,
         MAX(transaction_date) as latest_date
       FROM transactions 
       WHERE user_id = $1`,
            [userId]
        );

        const row = result.rows[0];
        return {
            totalTransactions: parseInt(row?.total_transactions || '0'),
            earliestDate: row?.earliest_date,
            latestDate: row?.latest_date,
        };
    }

    /**
     * Fetch transactions for export (no pagination limits)
     */
    private static async fetchTransactionsForExport(
        userId: string,
        filters: ExportFilters
    ) {
        const conditions: string[] = ['user_id = $1'];
        const params: any[] = [userId];
        let paramIndex = 2;

        if (filters.from) {
            conditions.push(`transaction_date >= $${paramIndex}`);
            params.push(filters.from);
            paramIndex++;
        }

        if (filters.to) {
            conditions.push(`transaction_date <= $${paramIndex}`);
            params.push(filters.to);
            paramIndex++;
        }

        if (filters.category) {
            conditions.push(`category = $${paramIndex}`);
            params.push(filters.category);
            paramIndex++;
        }

        if (filters.instrumentType) {
            conditions.push(`instrument_type = $${paramIndex}`);
            params.push(filters.instrumentType);
            paramIndex++;
        }

        if (filters.instrumentId) {
            conditions.push(`instrument_id = $${paramIndex}`);
            params.push(filters.instrumentId);
            paramIndex++;
        }

        if (filters.merchant) {
            conditions.push(`LOWER(merchant) LIKE $${paramIndex}`);
            params.push(`%${filters.merchant.toLowerCase()}%`);
            paramIndex++;
        }

        const query = `
      SELECT 
        transaction_date,
        merchant,
        category,
        amount,
        direction,
        transaction_type,
        instrument_type,
        description,
        reference_number
      FROM transactions
      WHERE ${conditions.join(' AND ')}
      ORDER BY transaction_date DESC
      LIMIT 50000
    `;

        const result = await pool.query(query, params);
        return result.rows;
    }

    /**
     * Escape value for CSV
     */
    private static escapeCSV(value: string): string {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }

    /**
     * Generate date range string for filename
     */
    private static getDateRangeString(filters: ExportFilters): string {
        const from = filters.from ? dayjs(filters.from).format('YYYYMMDD') : 'all';
        const to = filters.to ? dayjs(filters.to).format('YYYYMMDD') : 'present';
        return `${from}_to_${to}`;
    }
}
