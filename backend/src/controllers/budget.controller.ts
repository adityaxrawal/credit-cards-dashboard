import { AuthRequest } from '../types/auth.types';
import { Request, Response, NextFunction } from 'express';
import * as budgetService from '../services/bills/BudgetService';

/**
 * Get current budget status
 */
export async function getCurrentBudget(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;

    const status = await budgetService.getCurrentBudgetStatus(userId);

    res.json({ data: status });
  } catch (error) {
    next(error);
  }
}

/**
 * Update monthly budget
 */
import { z } from 'zod';
import { UpdateBudgetSchema } from '../validators/other.schema';

/**
 * Update monthly budget
 */
export async function updateBudget(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    // Zod Validation
    const validated = await UpdateBudgetSchema.parseAsync(req.body);

    const result = await budgetService.updateMonthlyBudget(userId, validated.monthlyBudget);

    res.json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid budget data',
          details: error.errors
        }
      });
    }
    next(error);
  }
}

/**
 * Get budget history
 */
export async function getBudgetHistory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 12;

    const history = await budgetService.getBudgetHistory(userId, limit);

    res.json({ data: history });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Category Envelopes (Advanced Budgeting)
 */
export async function getCategoryBudgets(req: AuthRequest, res: Response, next: NextFunction) {
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
}

/**
 * Set Category Budget Envelope
 */
export async function setCategoryBudget(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const { categoryId, amount, month, year } = req.body;

    // If month/year not provided, defaults to current in service, but let's be explicit
    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();

    await budgetService.setCategoryBudgetForMonth(userId, categoryId, parseFloat(amount), m, y);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Rollover Rule Status
 */
export async function getRolloverRule(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const isEnabled = await budgetService.getRolloverStatus(userId);
    res.json({ data: { enabled: isEnabled } });
  } catch (error) {
    next(error);
  }
}

/**
 * Set Rollover Rule
 */
export async function setRolloverRule(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const { enabled } = req.body;
    await budgetService.setRolloverRule(userId, !!enabled);
    res.json({ success: true, message: 'Rollover rule updated' });
  } catch (error) {
    next(error);
  }
}

/**
 * Link Budget to Savings
 */
export async function linkSavings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const { categoryId, goalId } = req.body;
    await budgetService.linkBudgetToSavings(userId, categoryId, goalId);
    res.json({ success: true, message: 'Budget linked to savings goal' });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Budget Alerts
 */
export async function getAlerts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const alerts = await budgetService.getBudgetAlerts(userId);
    res.json({ success: true, data: alerts });
  } catch (error) {
    next(error);
  }
}


