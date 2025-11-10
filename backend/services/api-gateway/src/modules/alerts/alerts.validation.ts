import { z } from "zod";

/**
 * Validation schemas for alert-related operations
 */

export const CreateAlertSchema = z.object({
  alert_type: z.enum([
    "due_date",
    "high_spending",
    "unusual_transaction",
    "budget_exceeded",
    "low_balance",
  ]),
  message: z.string().min(1, "Message is required").max(500),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
  metadata: z.record(z.any()).optional(),
  is_read: z.boolean().default(false),
});

export const UpdateAlertSchema = z.object({
  is_read: z.boolean(),
  is_dismissed: z.boolean().optional(),
});

export const AlertIdSchema = z.object({
  id: z.string().uuid("Invalid alert ID format"),
});

export const GetAlertsQuerySchema = z.object({
  unread_only: z
    .string()
    .transform((val) => val === "true")
    .pipe(z.boolean())
    .optional(),
  alert_type: z
    .enum(["due_date", "high_spending", "unusual_transaction", "budget_exceeded", "low_balance"])
    .optional(),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .optional(),
});

export type CreateAlertDto = z.infer<typeof CreateAlertSchema>;
export type UpdateAlertDto = z.infer<typeof UpdateAlertSchema>;
export type AlertIdDto = z.infer<typeof AlertIdSchema>;
export type GetAlertsQueryDto = z.infer<typeof GetAlertsQuerySchema>;
