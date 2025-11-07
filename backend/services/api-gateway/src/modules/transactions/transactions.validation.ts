import { z } from "zod";

/**
 * Transaction Validation Schemas
 */

export const createTransactionSchema = z.object({
  card_id: z.string().uuid().optional(),
  transaction_date: z.string().datetime(),
  merchant_name: z.string().min(1).max(200),
  merchant_category: z.string().max(100).optional(),
  amount: z.number().positive(),
  transaction_type: z.enum(["debit", "credit"]).default("debit"),
  description: z.string().max(500).optional(),
  is_manually_added: z.boolean().default(true),
  billing_cycle_month: z.number().int().min(1).max(12).optional(),
  billing_cycle_year: z.number().int().min(2020).max(2100).optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const transactionIdSchema = z.object({
  id: z.string().uuid("Invalid transaction ID"),
});

export const transactionFiltersSchema = z.object({
  card_id: z.string().uuid().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  transaction_type: z.enum(["debit", "credit"]).optional(),
  min_amount: z.coerce.number().positive().optional(),
  max_amount: z.coerce.number().positive().optional(),
  merchant_category: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
