import { z } from "zod";

/**
 * Validation schemas for rewards-related operations
 */

export const CreateRewardSchema = z.object({
  card_id: z.string().uuid("Invalid card ID"),
  reward_type: z.enum(["cashback", "points", "miles", "voucher", "discount"]),
  amount: z.number().positive("Reward amount must be positive"),
  points_value: z.number().positive().optional(),
  earned_date: z.string().datetime("Invalid date format"),
  expiry_date: z.string().datetime().optional(),
  description: z.string().max(500).optional(),
  is_redeemed: z.boolean().default(false),
  redeemed_date: z.string().datetime().optional(),
  redemption_details: z.string().optional(),
});

export const UpdateRewardSchema = CreateRewardSchema.partial();

export const RewardIdSchema = z.object({
  id: z.string().uuid("Invalid reward ID format"),
});

export const GetRewardsQuerySchema = z.object({
  card_id: z.string().uuid().optional(),
  reward_type: z.enum(["cashback", "points", "miles", "voucher", "discount"]).optional(),
  is_redeemed: z
    .string()
    .transform((val) => val === "true")
    .pipe(z.boolean())
    .optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .optional(),
});

export const RedeemRewardSchema = z.object({
  redemption_details: z.string().min(1, "Redemption details required").max(500),
});

export type CreateRewardDto = z.infer<typeof CreateRewardSchema>;
export type UpdateRewardDto = z.infer<typeof UpdateRewardSchema>;
export type RewardIdDto = z.infer<typeof RewardIdSchema>;
export type GetRewardsQueryDto = z.infer<typeof GetRewardsQuerySchema>;
export type RedeemRewardDto = z.infer<typeof RedeemRewardSchema>;
