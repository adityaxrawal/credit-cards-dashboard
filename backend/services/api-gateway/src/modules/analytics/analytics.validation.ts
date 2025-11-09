import { z } from "zod";

/**
 * Validation schemas for analytics-related operations
 */

export const SpendingAnalysisQuerySchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  card_id: z.string().uuid().optional(),
  category: z.string().optional(),
  period: z.enum(["daily", "weekly", "monthly", "yearly"]).default("monthly"),
});

export const CategoryAnalysisQuerySchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  top_n: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive().max(50))
    .optional(),
});

export const TrendAnalysisQuerySchema = z.object({
  months: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive().min(1).max(24))
    .default("6"),
  metric: z.enum(["spending", "transactions", "average_transaction"]).default("spending"),
});

export const PredictionQuerySchema = z.object({
  forecast_months: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive().min(1).max(12))
    .default("3"),
  category: z.string().optional(),
});

export type SpendingAnalysisQueryDto = z.infer<typeof SpendingAnalysisQuerySchema>;
export type CategoryAnalysisQueryDto = z.infer<typeof CategoryAnalysisQuerySchema>;
export type TrendAnalysisQueryDto = z.infer<typeof TrendAnalysisQuerySchema>;
export type PredictionQueryDto = z.infer<typeof PredictionQuerySchema>;
