import { z } from "zod";

/**
 * Budget Validation Schemas
 */

export const createBudgetSchema = z.object({
  category: z.string().min(1).max(100),
  amount: z.number().positive(),
  period: z.enum(["monthly", "quarterly", "annual"]).default("monthly"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const updateBudgetSchema = z.object({
  category: z.string().min(1).max(100).optional(),
  amount: z.number().positive().optional(),
  period: z.enum(["monthly", "quarterly", "annual"]).optional(),
  is_active: z.boolean().optional(),
});

export const budgetIdSchema = z.object({
  id: z.string().uuid("Invalid budget ID"),
});
