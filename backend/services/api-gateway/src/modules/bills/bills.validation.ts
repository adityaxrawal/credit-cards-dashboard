import { z } from "zod";

/**
 * Validation schemas for bill-related operations
 */

export const CreateBillSchema = z.object({
  card_id: z.string().uuid("Invalid card ID"),
  billing_period_start: z.string().datetime("Invalid date format"),
  billing_period_end: z.string().datetime("Invalid date format"),
  due_date: z.string().datetime("Invalid date format"),
  total_amount: z.number().positive("Total amount must be positive"),
  minimum_due: z.number().min(0, "Minimum due cannot be negative"),
  previous_balance: z.number().optional(),
  payments_credits: z.number().optional(),
  purchases: z.number().optional(),
  interest_charges: z.number().optional(),
  fees: z.number().optional(),
  is_paid: z.boolean().default(false),
  paid_amount: z.number().min(0).optional(),
  paid_date: z.string().datetime().optional(),
  payment_method: z.string().optional(),
});

export const UpdateBillSchema = CreateBillSchema.partial();

export const BillIdSchema = z.object({
  id: z.string().uuid("Invalid bill ID format"),
});

export const GetBillsQuerySchema = z.object({
  card_id: z.string().uuid().optional(),
  is_paid: z
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

export const PayBillSchema = z.object({
  paid_amount: z.number().positive("Payment amount must be positive"),
  paid_date: z.string().datetime().optional(),
  payment_method: z.string().min(1, "Payment method is required").optional(),
});

export type CreateBillDto = z.infer<typeof CreateBillSchema>;
export type UpdateBillDto = z.infer<typeof UpdateBillSchema>;
export type BillIdDto = z.infer<typeof BillIdSchema>;
export type GetBillsQueryDto = z.infer<typeof GetBillsQuerySchema>;
export type PayBillDto = z.infer<typeof PayBillSchema>;
