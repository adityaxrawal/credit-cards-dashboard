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
