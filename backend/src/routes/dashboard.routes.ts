import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    getDashboardSummary,
    getDashboardAlerts,
    getCashflow,
    getRecentTransactions,
    getBudgetUsage,
    getGoalsProgress,
    getSpendingInsights,
} from '../controllers/dashboard.controller';

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

// Dashboard summary - net worth, account totals, monthly snapshot
router.get('/summary', getDashboardSummary);

// Alerts - upcoming bills, low balance, credit utilization warnings
router.get('/alerts', getDashboardAlerts);

// Cashflow chart data - income vs expenses over time
router.get('/cashflow', getCashflow);

// Recent transactions for feed widget
router.get('/recent', getRecentTransactions);

// Budget usage summary
router.get('/budget-usage', getBudgetUsage);

// Goals progress overview
router.get('/goals-progress', getGoalsProgress);

// Spending insights and analytics
router.get('/insights', getSpendingInsights);

export default router;
