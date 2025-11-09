import { z } from "zod";

/**
 * Validation schemas for subscription-related operations
 */

export const CreateSubscriptionSchema = z.object({
  card_id: z.string().uuid("Invalid card ID"),
  service_name: z.string().min(1, "Service name is required").max(200),
  amount: z.number().positive("Amount must be positive"),
  billing_cycle: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
  start_date: z.string().datetime("Invalid start date format"),
  next_billing_date: z.string().datetime("Invalid next billing date format"),
  category: z.string().optional(),
  description: z.string().max(500).optional(),
  is_active: z.boolean().default(true),
  reminder_days_before: z.number().int().min(0).max(30).default(3),
});

export const UpdateSubscriptionSchema = CreateSubscriptionSchema.partial();

export const SubscriptionIdSchema = z.object({
  id: z.string().uuid("Invalid subscription ID format"),
});

export const GetSubscriptionsQuerySchema = z.object({
  card_id: z.string().uuid().optional(),
  is_active: z
    .string()
    .transform((val) => val === "true")
    .pipe(z.boolean())
    .optional(),
  billing_cycle: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]).optional(),
  category: z.string().optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .optional(),
});

export type CreateSubscriptionDto = z.infer<typeof CreateSubscriptionSchema>;
export type UpdateSubscriptionDto = z.infer<typeof UpdateSubscriptionSchema>;
export type SubscriptionIdDto = z.infer<typeof SubscriptionIdSchema>;
export type GetSubscriptionsQueryDto = z.infer<typeof GetSubscriptionsQuerySchema>;
