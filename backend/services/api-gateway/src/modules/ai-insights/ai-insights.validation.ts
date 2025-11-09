import { z } from "zod";

/**
 * Validation schemas for AI insights-related operations
 */

export const GenerateInsightSchema = z.object({
  insight_type: z.enum([
    "spending_pattern",
    "saving_opportunity",
    "unusual_activity",
    "budget_recommendation",
    "reward_optimization",
    "bill_prediction",
  ]),
  period: z.enum(["week", "month", "quarter", "year"]).default("month"),
  card_id: z.string().uuid().optional(),
  category: z.string().optional(),
});

export const InsightIdSchema = z.object({
  id: z.string().uuid("Invalid insight ID format"),
});

export const GetInsightsQuerySchema = z.object({
  insight_type: z
    .enum([
      "spending_pattern",
      "saving_opportunity",
      "unusual_activity",
      "budget_recommendation",
      "reward_optimization",
      "bill_prediction",
    ])
    .optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  is_read: z
    .string()
    .transform((val) => val === "true")
    .pipe(z.boolean())
    .optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive().max(100))
    .optional(),
});

export const MarkInsightSchema = z.object({
  is_read: z.boolean(),
  is_helpful: z.boolean().optional(),
  feedback: z.string().max(500).optional(),
});

export type GenerateInsightDto = z.infer<typeof GenerateInsightSchema>;
export type InsightIdDto = z.infer<typeof InsightIdSchema>;
export type GetInsightsQueryDto = z.infer<typeof GetInsightsQuerySchema>;
export type MarkInsightDto = z.infer<typeof MarkInsightSchema>;
