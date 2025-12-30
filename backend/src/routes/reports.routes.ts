/**
 * Reports Routes
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as reportsController from '../controllers/reports.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/reports/transactions/export/csv
 * @desc    Export transactions to CSV
 * @access  Private
 */
router.get('/transactions/export/csv', reportsController.exportTransactionsCSV);

/**
 * @route   GET /api/reports/transactions/export/excel
 * @desc    Export transactions to Excel
 * @access  Private
 */
router.get('/transactions/export/excel', reportsController.exportTransactionsExcel);

/**
 * @route   GET /api/reports/monthly-summary
 * @desc    Get monthly spending summary
 * @access  Private
 */
router.get('/monthly-summary', reportsController.getMonthlySummary);

/**
 * @route   GET /api/reports/stats
 * @desc    Get export statistics (date range, count)
 * @access  Private
 */
router.get('/stats', reportsController.getExportStats);

/**
 * @route   GET /api/reports/monthly-summary/pdf
 * @desc    Get monthly summary as PDF (HTML)
 * @access  Private
 */
router.get('/monthly-summary/pdf', reportsController.generateMonthlySummaryPDF);

/**
 * @route   GET /api/reports/category-breakdown/pdf
 * @desc    Get category breakdown as PDF (HTML)
 * @access  Private
 */
router.get('/category-breakdown/pdf', reportsController.generateCategoryBreakdownPDF);

export default router;
