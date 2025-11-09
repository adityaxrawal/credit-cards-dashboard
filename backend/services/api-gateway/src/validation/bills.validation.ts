import { z } from "zod";

/**
 * Bills Module Validation Schemas
 * Purpose: Validate bill creation, updates, payment tracking, and reminder settings
 */

// Bill status enum
export const BillStatusSchema = z.enum(["pending", "paid", "overdue", "partial"]);

// Base bill schema
export const CreateBillSchema = z
  .object({
    card_id: z.string().uuid("Invalid card ID"),
    bill_date: z.string().datetime().or(z.date()),
    due_date: z.string().datetime().or(z.date()),
    minimum_amount: z.number().nonnegative("Minimum amount must be non-negative"),
    total_amount: z.number().nonnegative("Total amount must be non-negative"),
    statement_period_start: z.string().datetime().or(z.date()),
    statement_period_end: z.string().datetime().or(z.date()),
    notes: z.string().optional(),
  })
  .refine((data) => new Date(data.due_date) > new Date(data.bill_date), {
    message: "Due date must be after bill date",
    path: ["due_date"],
  })
  .refine((data) => new Date(data.statement_period_end) > new Date(data.statement_period_start), {
    message: "Statement period end must be after start",
    path: ["statement_period_end"],
  });

export const UpdateBillSchema = z.object({
  paid_amount: z.number().nonnegative().optional(),
  status: BillStatusSchema.optional(),
  payment_date: z.string().datetime().or(z.date()).optional(),
  notes: z.string().optional(),
});

export const GetBillsQuerySchema = z.object({
  card_id: z.string().uuid().optional(),
  status: BillStatusSchema.optional(),
  start_date: z.string().datetime().or(z.date()).optional(),
  end_date: z.string().datetime().or(z.date()).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// Payment schemas
export const CreatePaymentSchema = z.object({
  card_id: z.string().uuid("Invalid card ID"),
  bill_id: z.string().uuid().optional(),
  amount: z.number().positive("Payment amount must be positive"),
  payment_date: z.string().datetime().or(z.date()).optional(),
  payment_method: z.string().max(100).optional(),
  transaction_id: z.string().max(255).optional(),
  notes: z.string().optional(),
});

export const UpdatePaymentSchema = z.object({
  status: z.enum(["success", "failed", "pending"]).optional(),
  notes: z.string().optional(),
});

// Reminder settings schemas
export const UpdateReminderSettingsSchema = z.object({
  enable_reminders: z.boolean().optional(),
  reminder_days: z.array(z.number().int().min(0).max(30)).min(1).max(10).optional(),
  enable_autopay_reminders: z.boolean().optional(),
  preferred_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)")
    .optional(),
  channels: z
    .array(z.enum(["email", "sms", "in_app", "push"]))
    .min(1)
    .optional(),
});

// Bill reminder record schema
export const CreateReminderRecordSchema = z.object({
  bill_id: z.string().uuid("Invalid bill ID"),
  reminder_date: z.string().datetime().or(z.date()),
  days_before: z.number().int().min(0).max(30),
});

// Generate bill for card schema
export const GenerateBillSchema = z.object({
  card_id: z.string().uuid("Invalid card ID"),
  force: z.boolean().default(false),
});

// Export types
export type CreateBillInput = z.infer<typeof CreateBillSchema>;
export type UpdateBillInput = z.infer<typeof UpdateBillSchema>;
export type GetBillsQuery = z.infer<typeof GetBillsQuerySchema>;
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof UpdatePaymentSchema>;
export type UpdateReminderSettingsInput = z.infer<typeof UpdateReminderSettingsSchema>;
export type CreateReminderRecordInput = z.infer<typeof CreateReminderRecordSchema>;
export type GenerateBillInput = z.infer<typeof GenerateBillSchema>;
