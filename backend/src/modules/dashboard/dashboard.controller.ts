import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '@shared/types/auth.types';

export interface IDashboardService {
    getSummary(userId: string): Promise<any>;
    getAlerts(userId: string): Promise<any>;
    getCashflow(userId: string, months: number): Promise<any>;
    getRecentTransactions(userId: string, limit: number): Promise<any>;
    getBudgetUsage(userId: string): Promise<any>;
    getGoalsProgress(userId: string): Promise<any>;
    getSpendingInsights(userId: string): Promise<any>;
}

export interface IDashboardController {
    getDashboardSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getDashboardAlerts(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getCashflow(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getRecentTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getBudgetUsage(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getGoalsProgress(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getSpendingInsights(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

export function createDashboardController(dashboardService: IDashboardService): IDashboardController {
    return {
        async getDashboardSummary(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const summary = await dashboardService.getSummary(userId);
                res.json({ data: summary });
            } catch (error) {
                next(error);
            }
        },

        async getDashboardAlerts(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const alerts = await dashboardService.getAlerts(userId);
                res.json({ data: alerts });
            } catch (error) {
                next(error);
            }
        },

        async getCashflow(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const months = parseInt(req.query.months as string) || 6;
                const cashflow = await dashboardService.getCashflow(userId, months);
                res.json({ data: cashflow });
            } catch (error) {
                next(error);
            }
        },

        async getRecentTransactions(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const limit = parseInt(req.query.limit as string) || 10;
                const transactions = await dashboardService.getRecentTransactions(userId, limit);
                res.json({ data: transactions });
            } catch (error) {
                next(error);
            }
        },

        async getBudgetUsage(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const usage = await dashboardService.getBudgetUsage(userId);
                res.json({ data: usage });
            } catch (error) {
                next(error);
            }
        },

        async getGoalsProgress(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const goals = await dashboardService.getGoalsProgress(userId);
                res.json({ data: goals });
            } catch (error) {
                next(error);
            }
        },

        async getSpendingInsights(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const insights = await dashboardService.getSpendingInsights(userId);
                res.json({ data: insights });
            } catch (error) {
                next(error);
            }
        }
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { DashboardService } from './dashboard.service';
const defaultController = createDashboardController(new DashboardService());

export const getDashboardSummary = defaultController.getDashboardSummary;
export const getDashboardAlerts = defaultController.getDashboardAlerts;
export const getCashflow = defaultController.getCashflow;
export const getRecentTransactions = defaultController.getRecentTransactions;
export const getBudgetUsage = defaultController.getBudgetUsage;
export const getGoalsProgress = defaultController.getGoalsProgress;
export const getSpendingInsights = defaultController.getSpendingInsights;

