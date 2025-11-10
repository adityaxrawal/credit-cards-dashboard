import { z } from "zod";

/**
 * Reports Module Validation Schemas
 * Purpose: Validate report generation, financial analysis, and export formats
 */

// Report type enum
export const ReportTypeSchema = z.enum([
  "spending_summary",
  "budget_analysis",
  "cash_flow",
  "merchant_analysis",
  "category_breakdown",
  "card_comparison",
  "rewards_summary",
  "subscription_report",
  "tax_summary",
  "custom",
]);

// Report format enum
export const ReportFormatSchema = z.enum(["pdf", "excel", "csv", "json"]);

// Report period enum
export const ReportPeriodSchema = z.enum(["week", "month", "quarter", "year", "custom"]);

// Generate report schema
export const GenerateReportSchema = z
  .object({
    report_type: ReportTypeSchema,
    period: ReportPeriodSchema,
    start_date: z.string().datetime().or(z.date()).optional(),
    end_date: z.string().datetime().or(z.date()).optional(),
    format: ReportFormatSchema.default("pdf"),
    include_charts: z.boolean().default(true),
    filters: z
      .object({
        card_ids: z.array(z.string().uuid()).optional(),
        categories: z.array(z.string()).optional(),
        merchants: z.array(z.string()).optional(),
        min_amount: z.number().nonnegative().optional(),
        max_amount: z.number().nonnegative().optional(),
      })
      .optional(),
    custom_fields: z.array(z.string()).optional(),
  })
  .refine(
    (data) => {
      if (data.period === "custom") {
        return data.start_date !== undefined && data.end_date !== undefined;
      }
      return true;
    },
    { message: 'start_date and end_date are required when period is "custom"', path: ["period"] }
  )
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return new Date(data.end_date) > new Date(data.start_date);
      }
      return true;
    },
    { message: "end_date must be after start_date" }
  )
  .refine(
    (data) => {
      if (data.filters?.min_amount !== undefined && data.filters?.max_amount !== undefined) {
        return data.filters.max_amount >= data.filters.min_amount;
      }
      return true;
    },
    { message: "max_amount must be greater than or equal to min_amount", path: ["filters"] }
  );

// Get reports query schema
export const GetReportsQuerySchema = z.object({
  report_type: ReportTypeSchema.optional(),
  period: ReportPeriodSchema.optional(),
  start_date: z.string().datetime().or(z.date()).optional(),
  end_date: z.string().datetime().or(z.date()).optional(),
  format: ReportFormatSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort_by: z.enum(["created_at", "report_type", "period"]).default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

// Spending summary schema
export const SpendingSummarySchema = z
  .object({
    start_date: z.string().datetime().or(z.date()),
    end_date: z.string().datetime().or(z.date()),
    group_by: z.enum(["category", "merchant", "card", "day", "week", "month"]).default("category"),
    include_comparisons: z.boolean().default(true),
    card_ids: z.array(z.string().uuid()).optional(),
  })
  .refine((data) => new Date(data.end_date) > new Date(data.start_date), {
    message: "end_date must be after start_date",
  });

// Budget analysis schema
export const BudgetAnalysisSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Invalid month format (YYYY-MM)")
    .optional(),
  include_forecasts: z.boolean().default(true),
  include_recommendations: z.boolean().default(true),
  categories: z.array(z.string()).optional(),
});

// Cash flow analysis schema
export const CashFlowAnalysisSchema = z
  .object({
    start_date: z.string().datetime().or(z.date()),
    end_date: z.string().datetime().or(z.date()),
    granularity: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
    include_projections: z.boolean().default(false),
  })
  .refine((data) => new Date(data.end_date) > new Date(data.start_date), {
    message: "end_date must be after start_date",
  });

// Merchant analysis schema
export const MerchantAnalysisSchema = z
  .object({
    start_date: z.string().datetime().or(z.date()),
    end_date: z.string().datetime().or(z.date()),
    min_transactions: z.number().int().min(1).default(2),
    sort_by: z.enum(["amount", "frequency", "name"]).default("amount"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((data) => new Date(data.end_date) > new Date(data.start_date), {
    message: "end_date must be after start_date",
  });

// Category breakdown schema
export const CategoryBreakdownSchema = z
  .object({
    start_date: z.string().datetime().or(z.date()),
    end_date: z.string().datetime().or(z.date()),
    include_subcategories: z.boolean().default(false),
    min_percentage: z.number().min(0).max(100).default(1),
    card_ids: z.array(z.string().uuid()).optional(),
  })
  .refine((data) => new Date(data.end_date) > new Date(data.start_date), {
    message: "end_date must be after start_date",
  });

// Card comparison schema
export const CardComparisonSchema = z
  .object({
    card_ids: z.array(z.string().uuid()).min(2, "At least 2 cards required for comparison"),
    start_date: z.string().datetime().or(z.date()),
    end_date: z.string().datetime().or(z.date()),
    metrics: z
      .array(z.enum(["spending", "rewards", "cashback", "fees", "utilization", "transactions"]))
      .min(1)
      .default(["spending", "rewards"]),
  })
  .refine((data) => new Date(data.end_date) > new Date(data.start_date), {
    message: "end_date must be after start_date",
  });

// Export report schema
export const ExportReportSchema = z.object({
  report_id: z.string().uuid("Invalid report ID"),
  format: ReportFormatSchema,
  include_raw_data: z.boolean().default(false),
});

// Schedule report schema (for future email delivery feature)
export const ScheduleReportSchema = z.object({
  report_type: ReportTypeSchema,
  period: ReportPeriodSchema,
  format: ReportFormatSchema,
  delivery_method: z.enum(["email", "download"]).default("email"),
  schedule: z.object({
    frequency: z.enum(["daily", "weekly", "monthly"]),
    day_of_week: z.number().int().min(0).max(6).optional(),
    day_of_month: z.number().int().min(1).max(31).optional(),
    time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
  }),
  filters: z
    .object({
      card_ids: z.array(z.string().uuid()).optional(),
      categories: z.array(z.string()).optional(),
    })
    .optional(),
});

// Export types
export type GenerateReportInput = z.infer<typeof GenerateReportSchema>;
export type GetReportsQuery = z.infer<typeof GetReportsQuerySchema>;
export type SpendingSummaryInput = z.infer<typeof SpendingSummarySchema>;
export type BudgetAnalysisInput = z.infer<typeof BudgetAnalysisSchema>;
export type CashFlowAnalysisInput = z.infer<typeof CashFlowAnalysisSchema>;
export type MerchantAnalysisInput = z.infer<typeof MerchantAnalysisSchema>;
export type CategoryBreakdownInput = z.infer<typeof CategoryBreakdownSchema>;
export type CardComparisonInput = z.infer<typeof CardComparisonSchema>;
export type ExportReportInput = z.infer<typeof ExportReportSchema>;
export type ScheduleReportInput = z.infer<typeof ScheduleReportSchema>;
