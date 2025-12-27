import { AuthRequest } from '../types/auth.types';
import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analytics/AnalyticsService';

/**
 * Get overview analytics
 */
export async function getOverview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;

    const overview = await AnalyticsService.getOverview(userId);

    res.json({ data: overview });
  } catch (error) {
    next(error);
  }
}

/**
 * Get category breakdown
 */
export async function getCategoryBreakdown(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;

    const breakdown = await AnalyticsService.getCategoryBreakdown(userId, month, year);

    res.json({ data: breakdown });
  } catch (error) {
    next(error);
  }
}

/**
 * Get spending trends
 */
export async function getTrends(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const range = req.query.range as string || '6m';

    const months = range === '12m' ? 12 : 6;

    const trends = await AnalyticsService.getTrends(userId, months);

    res.json({ data: trends });
  } catch (error) {
    next(error);
  }
}

/**
 * Get top merchants
 */
export async function getTopMerchants(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const merchants = await AnalyticsService.getTopMerchants(userId, limit);

    res.json({ data: merchants });
  } catch (error) {
    next(error);
  }
}
