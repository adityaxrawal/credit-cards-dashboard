import { z } from "zod";

/**
 * Card Validation Schemas
 */

export const createCardSchema = z.object({
  card_name: z.string().min(1, "Card name is required").max(100),
  last_four_digits: z
    .string()
    .length(4, "Must be 4 digits")
    .regex(/^\d{4}$/, "Must be numeric"),
  card_type: z.enum(["credit", "debit"]).default("credit"),
  bank_name: z.string().min(1).max(100),
  credit_limit: z.number().positive().optional(),
  bill_date: z.number().int().min(1).max(31),
  due_date: z.number().int().min(1).max(31),
  card_network: z
    .enum(["Visa", "Mastercard", "RuPay", "American Express", "Diners Club"])
    .optional(),
  reward_rate: z.number().min(0).max(100).optional(),
  annual_fee: z.number().min(0).optional(),
  is_active: z.boolean().default(true),
});

export const updateCardSchema = createCardSchema.partial();

export const cardIdSchema = z.object({
  id: z.string().uuid("Invalid card ID"),
});
