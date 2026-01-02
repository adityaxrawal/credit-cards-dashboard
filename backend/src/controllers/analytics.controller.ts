/**
 * Analytics Controller
 * 
 * Handles analytics and reporting endpoints.
 * Uses factory pattern for dependency injection.
 * 
 * Part of Issue #12: Controller-Service Dependency Injection
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';

/**
 * Analytics Service Interface
 */
export interface IAnalyticsService {
  getOverview(userId: string): Promise<any>;
  getCategoryBreakdown(userId: string, month?: number, year?: number): Promise<any>;
  getTrends(userId: string, months: number): Promise<any>;
  getTopMerchants(userId: string, limit: number): Promise<any>;
}

/**
 * Controller Interface
 */
export interface IAnalyticsController {
  getOverview(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  getCategoryBreakdown(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  getTrends(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  getTopMerchants(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

/**
 * Factory function to create Analytics controller with injected dependencies
 */
export function createAnalyticsController(analyticsService: IAnalyticsService): IAnalyticsController {
  return {
    async getOverview(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const overview = await analyticsService.getOverview(userId);
        res.json({ data: overview });
      } catch (error) {
        next(error);
      }
    },

    async getCategoryBreakdown(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const month = req.query.month ? parseInt(req.query.month as string) : undefined;
        const year = req.query.year ? parseInt(req.query.year as string) : undefined;
        const breakdown = await analyticsService.getCategoryBreakdown(userId, month, year);
        res.json({ data: breakdown });
      } catch (error) {
        next(error);
      }
    },

    async getTrends(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const range = req.query.range as string || '6m';
        const months = range === '12m' ? 12 : 6;
        const trends = await analyticsService.getTrends(userId, months);
        res.json({ data: trends });
      } catch (error) {
        next(error);
      }
    },

    async getTopMerchants(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
        const merchants = await analyticsService.getTopMerchants(userId, limit);
        res.json({ data: merchants });
      } catch (error) {
        next(error);
      }
    },
  };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { AnalyticsService } from '../services/analytics/AnalyticsService';

// Adapt static service to interface
const analyticsServiceAdapter: IAnalyticsService = {
  getOverview: (userId) => AnalyticsService.getOverview(userId),
  getCategoryBreakdown: (userId, month, year) => AnalyticsService.getCategoryBreakdown(userId, month, year),
  getTrends: (userId, months) => AnalyticsService.getTrends(userId, months),
  getTopMerchants: (userId, limit) => AnalyticsService.getTopMerchants(userId, limit),
};

const defaultController = createAnalyticsController(analyticsServiceAdapter);

export const getOverview = defaultController.getOverview;
export const getCategoryBreakdown = defaultController.getCategoryBreakdown;
export const getTrends = defaultController.getTrends;
export const getTopMerchants = defaultController.getTopMerchants;
