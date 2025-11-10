import { z } from "zod";

/**
 * Rewards Module Validation Schemas
 * Purpose: Validate reward points tracking, optimization, and redemption
 */

// Reward program type enum
export const RewardProgramTypeSchema = z.enum(["cashback", "points", "miles", "hybrid"]);

// Redemption status enum
export const RedemptionStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

// Redemption type enum
export const RedemptionTypeSchema = z.enum([
  "statement_credit",
  "cash",
  "travel",
  "gift_card",
  "merchandise",
  "transfer",
  "other",
]);

// Track rewards schema
export const TrackRewardsSchema = z.object({
  card_id: z.string().uuid("Invalid card ID"),
  transaction_id: z.string().uuid("Invalid transaction ID").optional(),
  points_earned: z.number().nonnegative("Points earned must be non-negative").default(0),
  cashback_earned: z.number().nonnegative("Cashback earned must be non-negative").default(0),
  category: z.string().max(100).optional(),
  earned_date: z.string().datetime().or(z.date()).optional(),
  notes: z.string().max(500).optional(),
});

// Get rewards analytics query
export const GetRewardsAnalyticsQuerySchema = z
  .object({
    card_id: z.string().uuid().optional(),
    start_date: z.string().datetime().or(z.date()).optional(),
    end_date: z.string().datetime().or(z.date()).optional(),
    group_by: z.enum(["card", "category", "month"]).default("card"),
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

// Get optimal card schema
export const GetOptimalCardSchema = z.object({
  category: z.string().min(1).max(100),
  amount: z.number().positive("Amount must be positive"),
  merchant: z.string().max(200).optional(),
});

// Process redemption schema
export const ProcessRedemptionSchema = z
  .object({
    card_id: z.string().uuid("Invalid card ID"),
    redemption_type: RedemptionTypeSchema,
    points_redeemed: z.number().positive("Points redeemed must be positive").optional(),
    cashback_redeemed: z.number().positive("Cashback redeemed must be positive").optional(),
    value: z.number().positive("Redemption value must be positive"),
    description: z.string().min(1).max(500),
    redemption_date: z.string().datetime().or(z.date()).optional(),
    confirmation_number: z.string().max(100).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((data) => data.points_redeemed !== undefined || data.cashback_redeemed !== undefined, {
    message: "Either points_redeemed or cashback_redeemed must be provided",
  });

// Update redemption schema
export const UpdateRedemptionSchema = z.object({
  status: RedemptionStatusSchema,
  notes: z.string().max(1000).optional(),
  completion_date: z.string().datetime().or(z.date()).optional(),
});

// Get redemptions query
export const GetRedemptionsQuerySchema = z.object({
  card_id: z.string().uuid().optional(),
  status: RedemptionStatusSchema.optional(),
  redemption_type: RedemptionTypeSchema.optional(),
  start_date: z.string().datetime().or(z.date()).optional(),
  end_date: z.string().datetime().or(z.date()).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// Rewards optimization recommendations query
export const GetOptimizationRecommendationsSchema = z.object({
  analysis_period_months: z.coerce.number().int().min(1).max(12).default(6),
  include_unused_cards: z.coerce.boolean().default(true),
});

// Calculate rewards value schema
export const CalculateRewardsValueSchema = z
  .object({
    card_id: z.string().uuid("Invalid card ID"),
    points: z.number().nonnegative().optional(),
    cashback: z.number().nonnegative().optional(),
    redemption_type: RedemptionTypeSchema.default("statement_credit"),
  })
  .refine((data) => data.points !== undefined || data.cashback !== undefined, {
    message: "Either points or cashback must be provided",
  });

// Export types
export type TrackRewardsInput = z.infer<typeof TrackRewardsSchema>;
export type GetRewardsAnalyticsQuery = z.infer<typeof GetRewardsAnalyticsQuerySchema>;
export type GetOptimalCardInput = z.infer<typeof GetOptimalCardSchema>;
export type ProcessRedemptionInput = z.infer<typeof ProcessRedemptionSchema>;
export type UpdateRedemptionInput = z.infer<typeof UpdateRedemptionSchema>;
export type GetRedemptionsQuery = z.infer<typeof GetRedemptionsQuerySchema>;
export type GetOptimizationRecommendationsQuery = z.infer<
  typeof GetOptimizationRecommendationsSchema
>;
export type CalculateRewardsValueInput = z.infer<typeof CalculateRewardsValueSchema>;
