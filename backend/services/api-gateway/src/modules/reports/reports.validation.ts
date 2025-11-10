import { z } from "zod";

/**
 * Validation schemas for reports-related operations
 */

export const CreateReportSchema = z.object({
  report_type: z.enum([
    "spending_summary",
    "category_breakdown",
    "card_utilization",
    "budget_performance",
    "monthly_trends",
    "yearly_summary",
    "cashflow_analysis",
    "merchant_analysis",
    "tax_summary",
    "custom",
  ]),
  report_name: z.string().min(1, "Report name is required").max(200),
  start_date: z.string().datetime("Invalid start date format"),
  end_date: z.string().datetime("Invalid end date format"),
  filters: z.record(z.any()).optional(),
  format: z.enum(["pdf", "csv", "excel", "json"]).default("pdf"),
});

export const ReportIdSchema = z.object({
  id: z.string().uuid("Invalid report ID format"),
});

export const GetReportsQuerySchema = z.object({
  report_type: z
    .enum([
      "spending_summary",
      "category_breakdown",
      "card_utilization",
      "budget_performance",
      "monthly_trends",
      "yearly_summary",
      "cashflow_analysis",
      "merchant_analysis",
      "tax_summary",
      "custom",
    ])
    .optional(),
  status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .optional(),
});

export const ExportReportSchema = z.object({
  format: z.enum(["pdf", "csv", "excel", "json"]),
});

export type CreateReportDto = z.infer<typeof CreateReportSchema>;
export type ReportIdDto = z.infer<typeof ReportIdSchema>;
export type GetReportsQueryDto = z.infer<typeof GetReportsQuerySchema>;
export type ExportReportDto = z.infer<typeof ExportReportSchema>;
