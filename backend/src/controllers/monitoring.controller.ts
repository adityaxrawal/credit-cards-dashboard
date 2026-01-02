import { AuthRequest } from '../types/auth.types';
import { Request, Response, NextFunction } from 'express';

export interface IMonitoringService {
    getStats(userId: string, period: 'day' | 'week' | 'month'): Promise<any>;
    getClassifierAccuracy(period: 'day' | 'week'): Promise<any>;
    getTerminationReport(userId: string, startDate: Date, endDate: Date): Promise<any>;
}

export interface IMonitoringController {
    getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getAccuracy(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getTerminations(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

export function createMonitoringController(service: IMonitoringService): IMonitoringController {
    return {
        async getStats(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const period = (req.query.period as 'day' | 'week' | 'month') || 'day';

                const stats = await service.getStats(userId, period);
                res.json({ data: stats });
            } catch (error) {
                next(error);
            }
        },

        async getAccuracy(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const period = (req.query.period as 'day' | 'week') || 'day';
                const accuracy = await service.getClassifierAccuracy(period);
                res.json({ data: accuracy });
            } catch (error) {
                next(error);
            }
        },

        async getTerminations(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

                const report = await service.getTerminationReport(userId, startDate, endDate);
                res.json({ data: report });
            } catch (error) {
                next(error);
            }
        }
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { TransactionMonitor } from '../services/infrastructure/monitoring/TransactionMonitor';

// Adapter for static method service
const monitoringServiceAdapter: IMonitoringService = {
    getStats: (userId, period) => TransactionMonitor.getStats(userId, period),
    getClassifierAccuracy: (period) => TransactionMonitor.getClassifierAccuracy(period),
    getTerminationReport: (userId, start, end) => TransactionMonitor.getTerminationReport(userId, start, end)
};

const defaultController = createMonitoringController(monitoringServiceAdapter);

export const getStats = defaultController.getStats;
export const getAccuracy = defaultController.getAccuracy;
export const getTerminations = defaultController.getTerminations;

