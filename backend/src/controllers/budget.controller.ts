import { Request, Response, NextFunction } from 'express';
import * as budgetService from '../services/budget.service';

/**
 * Get current budget status
 */
export async function getCurrentBudget(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    
    const status = await budgetService.getCurrentBudgetStatus(userId);
    
    res.json({ data: status });
  } catch (error) {
    next(error);
  }
}

/**
 * Update monthly budget
 */
export async function updateBudget(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { monthlyBudget } = req.body;
    
    if (!monthlyBudget || monthlyBudget <= 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid monthly budget is required',
        },
      });
    }
    
    const result = await budgetService.updateMonthlyBudget(userId, parseFloat(monthlyBudget));
    
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Get budget history
 */
export async function getBudgetHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 12;
    
    const history = await budgetService.getBudgetHistory(userId, limit);
    
    res.json({ data: history });
  } catch (error) {
    next(error);
  }
}
