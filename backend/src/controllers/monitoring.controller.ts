import { AuthRequest } from '../types/auth.types';
import { Request, Response, NextFunction } from 'express';
import { TransactionMonitor } from '../services/infrastructure/monitoring/TransactionMonitor';

/**
 * Get pipeline processing stats
 */
export async function getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const userId = req.user.id;
        const period = (req.query.period as 'day' | 'week' | 'month') || 'day';

        const stats = await TransactionMonitor.getStats(userId, period);
        res.json({ data: stats });
    } catch (error) {
        next(error);
    }
}

/**
 * Get classifier accuracy metrics
 */
export async function getAccuracy(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const period = (req.query.period as 'day' | 'week') || 'day';
        const accuracy = await TransactionMonitor.getClassifierAccuracy(period);
        res.json({ data: accuracy });
    } catch (error) {
        next(error);
    }
}

/**
 * Get termination report
 */
export async function getTerminations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const userId = req.user.id;
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

        const report = await TransactionMonitor.getTerminationReport(userId, startDate, endDate);
        res.json({ data: report });
    } catch (error) {
        next(error);
    }
}
