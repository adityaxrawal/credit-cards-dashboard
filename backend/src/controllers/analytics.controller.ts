import { Request, Response, NextFunction } from 'express';
import * as analyticsService from '../services/analytics.service';

/**
 * Get overview analytics
 */
export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    
    const overview = await analyticsService.getOverview(userId);
    
    res.json({ data: overview });
  } catch (error) {
    next(error);
  }
}

/**
 * Get category breakdown
 */
export async function getCategoryBreakdown(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    
    const breakdown = await analyticsService.getCategoryBreakdown(userId, month, year);
    
    res.json({ data: breakdown });
  } catch (error) {
    next(error);
  }
}

/**
 * Get spending trends
 */
export async function getTrends(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const range = req.query.range as string || '6m';
    
    const months = range === '12m' ? 12 : 6;
    
    const trends = await analyticsService.getTrends(userId, months);
    
    res.json({ data: trends });
  } catch (error) {
    next(error);
  }
}

/**
 * Get top merchants
 */
export async function getTopMerchants(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    const merchants = await analyticsService.getTopMerchants(userId, month, year, limit);
    
    res.json({ data: merchants });
  } catch (error) {
    next(error);
  }
}
