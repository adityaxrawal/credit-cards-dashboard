import { z } from "zod";

/**
 * AI Insights Module Validation Schemas
 * Purpose: Validate AI-powered analysis, predictions, and recommendations
 */

// Insight type enum
export const InsightTypeSchema = z.enum([
  "spending_pattern",
  "anomaly_detection",
  "prediction",
  "recommendation",
  "trend_analysis",
  "risk_alert",
  "optimization",
  "fraud_detection",
]);

// Insight priority enum
export const InsightPrioritySchema = z.enum(["low", "medium", "high", "critical"]);

// Analysis type enum
export const AnalysisTypeSchema = z.enum([
  "spending",
  "budget",
  "rewards",
  "bills",
  "subscriptions",
  "overall",
]);

// Generate insights request schema
export const GenerateInsightsSchema = z
  .object({
    analysis_type: AnalysisTypeSchema.optional(),
    start_date: z.string().datetime().or(z.date()).optional(),
    end_date: z.string().datetime().or(z.date()).optional(),
    min_priority: InsightPrioritySchema.optional(),
    force_refresh: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return new Date(data.end_date) > new Date(data.start_date);
      }
      return true;
    },
    { message: "end_date must be after start_date" }
  );

// Get insights query schema
export const GetInsightsQuerySchema = z.object({
  insight_type: InsightTypeSchema.optional(),
  analysis_type: AnalysisTypeSchema.optional(),
  priority: InsightPrioritySchema.optional(),
  start_date: z.string().datetime().or(z.date()).optional(),
  end_date: z.string().datetime().or(z.date()).optional(),
  is_read: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// Spending prediction schema
export const PredictSpendingSchema = z.object({
  category: z.string().max(100).optional(),
  card_id: z.string().uuid().optional(),
  prediction_months: z.number().int().min(1).max(12).default(3),
  confidence_threshold: z.number().min(0).max(1).default(0.7),
});

// Anomaly detection schema
export const DetectAnomaliesSchema = z
  .object({
    start_date: z.string().datetime().or(z.date()).optional(),
    end_date: z.string().datetime().or(z.date()).optional(),
    categories: z.array(z.string()).optional(),
    sensitivity: z.enum(["low", "medium", "high"]).default("medium"),
    min_amount: z.number().nonnegative().optional(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return new Date(data.end_date) > new Date(data.start_date);
      }
      return true;
    },
    { message: "end_date must be after start_date" }
  );

// Get recommendations schema
export const GetRecommendationsSchema = z.object({
  recommendation_type: z
    .enum([
      "card_optimization",
      "budget_adjustment",
      "subscription_review",
      "rewards_maximization",
      "bill_payment",
      "general",
    ])
    .optional(),
  priority: InsightPrioritySchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// Mark insight as read schema
export const MarkInsightReadSchema = z.object({
  insight_id: z.string().uuid("Invalid insight ID"),
  feedback: z.string().max(500).optional(),
  is_helpful: z.boolean().optional(),
});

// Spending trend analysis schema
export const AnalyzeSpendingTrendsSchema = z
  .object({
    start_date: z.string().datetime().or(z.date()),
    end_date: z.string().datetime().or(z.date()),
    group_by: z.enum(["day", "week", "month", "category", "merchant"]).default("month"),
    categories: z.array(z.string()).optional(),
    card_ids: z.array(z.string().uuid()).optional(),
  })
  .refine((data) => new Date(data.end_date) > new Date(data.start_date), {
    message: "end_date must be after start_date",
  });

// Budget health check schema
export const BudgetHealthCheckSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Invalid month format (YYYY-MM)")
    .optional(),
  include_predictions: z.boolean().default(true),
});

// Card usage optimization schema
export const OptimizeCardUsageSchema = z.object({
  analysis_period_months: z.number().int().min(1).max(12).default(6),
  include_rewards_analysis: z.boolean().default(true),
  include_fee_analysis: z.boolean().default(true),
});

// Export types
export type GenerateInsightsInput = z.infer<typeof GenerateInsightsSchema>;
export type GetInsightsQuery = z.infer<typeof GetInsightsQuerySchema>;
export type PredictSpendingInput = z.infer<typeof PredictSpendingSchema>;
export type DetectAnomaliesInput = z.infer<typeof DetectAnomaliesSchema>;
export type GetRecommendationsInput = z.infer<typeof GetRecommendationsSchema>;
export type MarkInsightReadInput = z.infer<typeof MarkInsightReadSchema>;
export type AnalyzeSpendingTrendsInput = z.infer<typeof AnalyzeSpendingTrendsSchema>;
export type BudgetHealthCheckInput = z.infer<typeof BudgetHealthCheckSchema>;
export type OptimizeCardUsageInput = z.infer<typeof OptimizeCardUsageSchema>;
