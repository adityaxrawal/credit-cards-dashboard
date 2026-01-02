/**
 * Report Service - Export and report generation
 */

import { TransactionRepository } from '@modules/transactions/repositories/TransactionRepository';
import { ReportRepository } from '@modules/reports/reports.repository';
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

        const aggregations = await TransactionRepository.getAggregations(userId, {
            from,
            to,
        });

        // Get monthly summary from repository (includes counts and totals)
        const summary = await ReportRepository.getMonthlySummary(userId, month, year);

        return {
            month,
            year,
            totalSpent: aggregations.totalSpent,
            totalTransactions: parseInt(summary?.transaction_count || '0'),
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
        // ... HTML generation logic ... (keeping same as before for brevity in diff, but verifying it assumes correct summary structure)
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
    /**
     * Generate category breakdown report as PDF-ready HTML
     */
    static async generateCategoryBreakdownPDF(
        userId: string,
        startDate: Date,
        endDate: Date
    ): Promise<ExportResult> {
        const aggregations = await TransactionRepository.getAggregations(userId, {
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
        const row = await ReportRepository.getExportStats(userId);
        return {
            totalTransactions: parseInt(row?.total_transactions || '0'),
            earliestDate: row?.earliest_transaction,
            latestDate: row?.latest_transaction,
        };
    }

    /**
     * Fetch transactions for export (no pagination limits)
     */
    private static async fetchTransactionsForExport(
        userId: string,
        filters: ExportFilters
    ) {
        return ReportRepository.getTransactionsForExport(userId, filters);
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
     * Generate Year in Review Report
     */
    static async generateYearInReview(userId: string, year: number) {
        const from = dayjs().year(year).startOf('year').toDate();
        const to = dayjs().year(year).endOf('year').toDate();

        const aggregations = await TransactionRepository.getAggregations(userId, { from, to });

        // Find top merchants
        const topMerchants = await ReportRepository.getTopMerchants(userId, from, to, 5);

        return {
            year,
            totalSpent: aggregations.totalSpent,
            topCategories: aggregations.byCategory.slice(0, 3),
            topMerchants: topMerchants,
            generatedAt: new Date()
        };
    }

    /**
     * Get AI-driven Spending Insights (Stub/Rule-based first)
     */
    static async getSpendingInsights(userId: string): Promise<string[]> {
        const insights: string[] = [];
        const now = dayjs();
        const thisMonthStart = now.startOf('month').toDate();
        // const lastMonthStart = now.subtract(1, 'month').startOf('month').toDate();
        // const lastMonthEnd = now.subtract(1, 'month').endOf('month').toDate();

        // 1. Compare total spending (This Month vs Last Month same day)
        // ... implementation simplified for stub ...

        // 2. Detect large transactions
        const largeTxns = await ReportRepository.getLargeTransactions(userId, thisMonthStart, 5000, 3);

        if (largeTxns.length > 0) {
            insights.push(`You have made ${largeTxns.length} large transactions (>5k) this month.`);
        }

        insights.push("Spending on 'Food' is 15% higher than last month's average."); // Mock
        insights.push("You are on track to save ₹12,000 this month based on current trends."); // Mock


        return insights;
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


