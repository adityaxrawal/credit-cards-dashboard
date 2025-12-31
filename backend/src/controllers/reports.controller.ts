/**
 * Reports Controller - Export and report generation endpoints
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
import { ReportService, ExportFilters } from '../services/reports/ReportService';
import logger from '../utils/infrastructure/logger';

/**
 * Export transactions to CSV
 */
export async function exportTransactionsCSV(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const filters = parseExportFilters(req.query);

        logger.info('export_transactions_csv', { userId, filters });

        const result = await ReportService.exportTransactionsCSV(userId, filters);

        res.setHeader('Content-Type', result.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('X-Row-Count', result.rowCount.toString());

        res.send(result.data);
    } catch (error) {
        logger.error('export_transactions_csv_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Export transactions to Excel format
 */
export async function exportTransactionsExcel(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const filters = parseExportFilters(req.query);

        logger.info('export_transactions_excel', { userId, filters });

        const result = await ReportService.exportTransactionsExcel(userId, filters);

        res.setHeader('Content-Type', result.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('X-Row-Count', result.rowCount.toString());

        res.send(result.data);
    } catch (error) {
        logger.error('export_transactions_excel_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Get monthly summary report
 */
export async function getMonthlySummary(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year as string) || new Date().getFullYear();

        const summary = await ReportService.generateMonthlySummary(userId, month, year);

        res.json({
            success: true,
            data: summary,
        });
    } catch (error) {
        logger.error('get_monthly_summary_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Get export statistics
 */
export async function getExportStats(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const stats = await ReportService.getExportStats(userId);

        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        logger.error('get_export_stats_error', { error, userId: req.user?.id });
        next(error);
    }
}


/**
 * Generate Monthly Summary PDF
 */
export async function generateMonthlySummaryPDF(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year as string) || new Date().getFullYear();

        const result = await ReportService.generateMonthlySummaryPDF(userId, month, year);

        res.setHeader('Content-Type', result.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.data);
    } catch (error) {
        logger.error('generate_monthly_summary_pdf_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Generate Category Breakdown PDF
 */
export async function generateCategoryBreakdownPDF(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const from = req.query.from ? new Date(req.query.from as string) : new Date();
        const to = req.query.to ? new Date(req.query.to as string) : new Date();

        const result = await ReportService.generateCategoryBreakdownPDF(userId, from, to);

        res.setHeader('Content-Type', result.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.data);
    } catch (error) {
        logger.error('generate_category_breakdown_pdf_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Parse query parameters into export filters
 */
function parseExportFilters(query: any): ExportFilters {
    return {
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        category: query.category as string,
        instrumentType: query.instrumentType as string,
        instrumentId: query.instrumentId as string,
        merchant: query.merchant as string,
    };
}

/**
 * Get Year in Review
 */
export async function getYearInReview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const userId = req.user.id;
        const year = parseInt(req.query.year as string) || new Date().getFullYear();
        const data = await ReportService.generateYearInReview(userId, year);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
}

/**
 * Get Spending Insights
 */
export async function getSpendingInsights(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const userId = req.user.id;
        const insights = await ReportService.getSpendingInsights(userId);
        res.json({ success: true, data: insights });
    } catch (error) {
        next(error);
    }
}

