/**
 * Budget Controller
 * 
 * Handles budget management endpoints.
 * Uses factory pattern for dependency injection.
 * 
 * Part of Issue #12: Controller-Service Dependency Injection
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '@shared/types/auth.types';
import { UpdateBudgetSchema } from '@shared/utils/validation/other.schema';

/**
 * Budget Service Interface
 */
export interface IBudgetService {
  getCurrentBudgetStatus(userId: string): Promise<any>;
  updateMonthlyBudget(userId: string, amount: number): Promise<any>;
  getBudgetHistory(userId: string, limit: number): Promise<any>;
  getCategoryBudgets(userId: string, month: number, year: number): Promise<any>;
  setCategoryBudgetForMonth(userId: string, categoryId: string, amount: number, month: number, year: number): Promise<void>;
  getRolloverStatus(userId: string): Promise<boolean>;
  setRolloverRule(userId: string, enabled: boolean): Promise<void>;
  linkBudgetToSavings(userId: string, categoryId: string, goalId: string): Promise<any>;
  getBudgetAlerts(userId: string): Promise<any>;
}

/**
 * Controller Interface
 */
export interface IBudgetController {
  getCurrentBudget(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  updateBudget(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  getBudgetHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  getCategoryBudgets(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  setCategoryBudget(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  getRolloverRule(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  setRolloverRule(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  linkSavings(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  getAlerts(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

/**
 * Factory function to create Budget controller with injected dependencies
 */
export function createBudgetController(budgetService: IBudgetService): IBudgetController {
  return {
    async getCurrentBudget(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const status = await budgetService.getCurrentBudgetStatus(userId);
        res.json({ data: status });
      } catch (error) {
        next(error);
      }
    },

    async updateBudget(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const validated = await UpdateBudgetSchema.parseAsync(req.body);
        const result = await budgetService.updateMonthlyBudget(userId, validated.monthlyBudget);
        res.json({ data: result });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(422).json({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid budget data', details: error.errors }
          }) as any;
        }
        next(error);
      }
    },

    async getBudgetHistory(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 12;
        const history = await budgetService.getBudgetHistory(userId, limit);
        res.json({ data: history });
      } catch (error) {
        next(error);
      }
    },

    async getCategoryBudgets(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const now = new Date();
        const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
        const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();
        const envelopes = await budgetService.getCategoryBudgets(userId, month, year);
        res.json({ data: envelopes });
      } catch (error) {
        next(error);
      }
    },

    async setCategoryBudget(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { categoryId, amount, month, year } = req.body;
        const m = month || new Date().getMonth() + 1;
        const y = year || new Date().getFullYear();
        await budgetService.setCategoryBudgetForMonth(userId, categoryId, parseFloat(amount), m, y);
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    },

    async getRolloverRule(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const isEnabled = await budgetService.getRolloverStatus(userId);
        res.json({ data: { enabled: isEnabled } });
      } catch (error) {
        next(error);
      }
    },

    async setRolloverRule(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { enabled } = req.body;
        await budgetService.setRolloverRule(userId, !!enabled);
        res.json({ success: true, message: 'Rollover rule updated' });
      } catch (error) {
        next(error);
      }
    },

    async linkSavings(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { categoryId, goalId } = req.body;
        await budgetService.linkBudgetToSavings(userId, categoryId, goalId);
        res.json({ success: true, message: 'Budget linked to savings goal' });
      } catch (error) {
        next(error);
      }
    },

    async getAlerts(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const alerts = await budgetService.getBudgetAlerts(userId);
        res.json({ success: true, data: alerts });
      } catch (error) {
        next(error);
      }
    },
  };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import * as budgetService from './budget.service';

const defaultController = createBudgetController(budgetService as IBudgetService);

export const getCurrentBudget = defaultController.getCurrentBudget;
export const updateBudget = defaultController.updateBudget;
export const getBudgetHistory = defaultController.getBudgetHistory;
export const getCategoryBudgets = defaultController.getCategoryBudgets;
export const setCategoryBudget = defaultController.setCategoryBudget;
export const getRolloverRule = defaultController.getRolloverRule;
export const setRolloverRule = defaultController.setRolloverRule;
export const linkSavings = defaultController.linkSavings;
export const getAlerts = defaultController.getAlerts;
