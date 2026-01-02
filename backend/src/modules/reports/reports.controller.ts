/**
 * Reports Controller
 * 
 * Handles export and report generation endpoints.
 * Uses factory pattern for dependency injection.
 * 
 * Part of Issue #12: Controller-Service Dependency Injection
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '@shared/types/auth.types';
import logger from '@shared/utils/infrastructure/logger';

/**
 * Export Filters Interface
 */
export interface ExportFilters {
    from?: Date;
    to?: Date;
    category?: string;
    instrumentType?: string;
    instrumentId?: string;
    merchant?: string;
}

/**
 * Report Service Interface
 */
export interface IReportService {
    exportTransactionsCSV(userId: string, filters: ExportFilters): Promise<{ data: any; mimeType: string; filename: string; rowCount: number }>;
    exportTransactionsExcel(userId: string, filters: ExportFilters): Promise<{ data: any; mimeType: string; filename: string; rowCount: number }>;
    generateMonthlySummary(userId: string, month: number, year: number): Promise<any>;
    getExportStats(userId: string): Promise<any>;
    generateMonthlySummaryPDF(userId: string, month: number, year: number): Promise<{ data: any; mimeType: string; filename: string }>;
    generateCategoryBreakdownPDF(userId: string, from: Date, to: Date): Promise<{ data: any; mimeType: string; filename: string }>;
    generateYearInReview(userId: string, year: number): Promise<any>;
    getSpendingInsights(userId: string): Promise<any>;
}

/**
 * Controller Interface
 */
export interface IReportsController {
    exportTransactionsCSV(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    exportTransactionsExcel(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getMonthlySummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getExportStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    generateMonthlySummaryPDF(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    generateCategoryBreakdownPDF(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getYearInReview(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getSpendingInsights(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

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
 * Factory function to create Reports controller with injected dependencies
 */
export function createReportsController(reportService: IReportService): IReportsController {
    return {
        async exportTransactionsCSV(req, res, next) {
            try {
                const filters = parseExportFilters(req.query);
                logger.info('export_transactions_csv', { userId: req.user.id, filters });
                const result = await reportService.exportTransactionsCSV(req.user.id, filters);
                res.setHeader('Content-Type', result.mimeType);
                res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
                res.setHeader('X-Row-Count', result.rowCount.toString());
                res.send(result.data);
            } catch (error) {
                logger.error('export_transactions_csv_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async exportTransactionsExcel(req, res, next) {
            try {
                const filters = parseExportFilters(req.query);
                logger.info('export_transactions_excel', { userId: req.user.id, filters });
                const result = await reportService.exportTransactionsExcel(req.user.id, filters);
                res.setHeader('Content-Type', result.mimeType);
                res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
                res.setHeader('X-Row-Count', result.rowCount.toString());
                res.send(result.data);
            } catch (error) {
                logger.error('export_transactions_excel_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async getMonthlySummary(req, res, next) {
            try {
                const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
                const year = parseInt(req.query.year as string) || new Date().getFullYear();
                const summary = await reportService.generateMonthlySummary(req.user.id, month, year);
                res.json({ success: true, data: summary });
            } catch (error) {
                logger.error('get_monthly_summary_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async getExportStats(req, res, next) {
            try {
                const stats = await reportService.getExportStats(req.user.id);
                res.json({ success: true, data: stats });
            } catch (error) {
                logger.error('get_export_stats_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async generateMonthlySummaryPDF(req, res, next) {
            try {
                const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
                const year = parseInt(req.query.year as string) || new Date().getFullYear();
                const result = await reportService.generateMonthlySummaryPDF(req.user.id, month, year);
                res.setHeader('Content-Type', result.mimeType);
                res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
                res.send(result.data);
            } catch (error) {
                logger.error('generate_monthly_summary_pdf_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async generateCategoryBreakdownPDF(req, res, next) {
            try {
                const from = req.query.from ? new Date(req.query.from as string) : new Date();
                const to = req.query.to ? new Date(req.query.to as string) : new Date();
                const result = await reportService.generateCategoryBreakdownPDF(req.user.id, from, to);
                res.setHeader('Content-Type', result.mimeType);
                res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
                res.send(result.data);
            } catch (error) {
                logger.error('generate_category_breakdown_pdf_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async getYearInReview(req, res, next) {
            try {
                const year = parseInt(req.query.year as string) || new Date().getFullYear();
                const data = await reportService.generateYearInReview(req.user.id, year);
                res.json({ success: true, data });
            } catch (error) { next(error); }
        },

        async getSpendingInsights(req, res, next) {
            try {
                const insights = await reportService.getSpendingInsights(req.user.id);
                res.json({ success: true, data: insights });
            } catch (error) { next(error); }
        },
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { ReportService } from './reports.service';

// Adapt static service to interface
const serviceAdapter: IReportService = {
    exportTransactionsCSV: (userId, filters) => ReportService.exportTransactionsCSV(userId, filters),
    exportTransactionsExcel: (userId, filters) => ReportService.exportTransactionsExcel(userId, filters),
    generateMonthlySummary: (userId, month, year) => ReportService.generateMonthlySummary(userId, month, year),
    getExportStats: (userId) => ReportService.getExportStats(userId),
    generateMonthlySummaryPDF: (userId, month, year) => ReportService.generateMonthlySummaryPDF(userId, month, year),
    generateCategoryBreakdownPDF: (userId, from, to) => ReportService.generateCategoryBreakdownPDF(userId, from, to),
    generateYearInReview: (userId, year) => ReportService.generateYearInReview(userId, year),
    getSpendingInsights: (userId) => ReportService.getSpendingInsights(userId),
};

const defaultController = createReportsController(serviceAdapter);

export const exportTransactionsCSV = defaultController.exportTransactionsCSV;
export const exportTransactionsExcel = defaultController.exportTransactionsExcel;
export const getMonthlySummary = defaultController.getMonthlySummary;
export const getExportStats = defaultController.getExportStats;
export const generateMonthlySummaryPDF = defaultController.generateMonthlySummaryPDF;
export const generateCategoryBreakdownPDF = defaultController.generateCategoryBreakdownPDF;
export const getYearInReview = defaultController.getYearInReview;
export const getSpendingInsights = defaultController.getSpendingInsights;
