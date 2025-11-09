import { z } from "zod";

/**
 * Subscriptions Module Validation Schemas
 * Purpose: Validate subscription tracking, detection, and management
 */

// Subscription status enum
export const SubscriptionStatusSchema = z.enum(["active", "paused", "cancelled", "expired"]);

// Subscription category enum
export const SubscriptionCategorySchema = z.enum([
  "streaming",
  "music",
  "software",
  "gaming",
  "fitness",
  "education",
  "news",
  "productivity",
  "cloud_storage",
  "communication",
  "other",
]);

// Billing cycle enum
export const BillingCycleSchema = z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]);

// Create subscription schema
export const CreateSubscriptionSchema = z
  .object({
    name: z.string().min(1).max(200, "Name must be 200 characters or less"),
    merchant: z.string().min(1).max(200),
    amount: z.number().positive("Amount must be positive"),
    billing_cycle: BillingCycleSchema,
    start_date: z.string().datetime().or(z.date()),
    next_billing_date: z.string().datetime().or(z.date()),
    category: SubscriptionCategorySchema.optional(),
    card_id: z.string().uuid("Invalid card ID").optional(),
    notes: z.string().max(1000).optional(),
    auto_renew: z.boolean().default(true),
  })
  .refine((data) => new Date(data.next_billing_date) >= new Date(data.start_date), {
    message: "Next billing date must be on or after start date",
    path: ["next_billing_date"],
  });

// Update subscription schema
export const UpdateSubscriptionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  merchant: z.string().min(1).max(200).optional(),
  amount: z.number().positive().optional(),
  billing_cycle: BillingCycleSchema.optional(),
  next_billing_date: z.string().datetime().or(z.date()).optional(),
  category: SubscriptionCategorySchema.optional(),
  card_id: z.string().uuid().optional(),
  status: SubscriptionStatusSchema.optional(),
  notes: z.string().max(1000).optional(),
  auto_renew: z.boolean().optional(),
  cancellation_date: z.string().datetime().or(z.date()).optional(),
});

// Get subscriptions query schema
export const GetSubscriptionsQuerySchema = z
  .object({
    status: SubscriptionStatusSchema.optional(),
    category: SubscriptionCategorySchema.optional(),
    card_id: z.string().uuid().optional(),
    min_amount: z.coerce.number().nonnegative().optional(),
    max_amount: z.coerce.number().nonnegative().optional(),
    billing_cycle: BillingCycleSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine(
    (data) => {
      if (data.min_amount !== undefined && data.max_amount !== undefined) {
        return data.max_amount >= data.min_amount;
      }
      return true;
    },
    { message: "max_amount must be greater than or equal to min_amount" }
  );

// Detect subscriptions schema
export const DetectSubscriptionsSchema = z
  .object({
    start_date: z.string().datetime().or(z.date()).optional(),
    end_date: z.string().datetime().or(z.date()).optional(),
    min_confidence: z.number().min(0).max(1).default(0.7),
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

// Cancel subscription schema
export const CancelSubscriptionSchema = z.object({
  cancellation_date: z.string().datetime().or(z.date()).optional(),
  reason: z.string().max(500).optional(),
});

// Subscription analytics query
export const SubscriptionAnalyticsQuerySchema = z.object({
  period: z.enum(["month", "quarter", "year"]).default("month"),
  include_cancelled: z.coerce.boolean().default(false),
});

// Export types
export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof UpdateSubscriptionSchema>;
export type GetSubscriptionsQuery = z.infer<typeof GetSubscriptionsQuerySchema>;
export type DetectSubscriptionsInput = z.infer<typeof DetectSubscriptionsSchema>;
export type CancelSubscriptionInput = z.infer<typeof CancelSubscriptionSchema>;
export type SubscriptionAnalyticsQuery = z.infer<typeof SubscriptionAnalyticsQuerySchema>;
