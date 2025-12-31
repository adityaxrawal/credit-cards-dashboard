import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
import { DashboardService } from '../services/dashboard/dashboard.service';

const dashboardService = new DashboardService();

/**
 * Get dashboard summary including net worth, account totals, monthly snapshot
 */
export async function getDashboardSummary(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const summary = await dashboardService.getSummary(userId);
        res.json({ data: summary });
    } catch (error) {
        next(error);
    }
}

/**
 * Get alerts panel data - upcoming bills, low balance warnings, etc.
 */
export async function getDashboardAlerts(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const alerts = await dashboardService.getAlerts(userId);
        res.json({ data: alerts });
    } catch (error) {
        next(error);
    }
}

/**
 * Get cashflow data for charts - income vs expenses over time
 */
export async function getCashflow(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const months = parseInt(req.query.months as string) || 6;
        const cashflow = await dashboardService.getCashflow(userId, months);
        res.json({ data: cashflow });
    } catch (error) {
        next(error);
    }
}

/**
 * Get recent transactions for dashboard feed
 */
export async function getRecentTransactions(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit as string) || 10;
        const transactions = await dashboardService.getRecentTransactions(userId, limit);
        res.json({ data: transactions });
    } catch (error) {
        next(error);
    }
}

/**
 * Get budget usage summary
 */
export async function getBudgetUsage(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const usage = await dashboardService.getBudgetUsage(userId);
        res.json({ data: usage });
    } catch (error) {
        next(error);
    }
}

/**
 * Get goals progress summary
 */
export async function getGoalsProgress(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const goals = await dashboardService.getGoalsProgress(userId);
        res.json({ data: goals });
    } catch (error) {
        next(error);
    }
}

/**
 * Get spending insights
 */
export async function getSpendingInsights(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const insights = await dashboardService.getSpendingInsights(userId);
        res.json({ data: insights });
    } catch (error) {
        next(error);
    }
}
