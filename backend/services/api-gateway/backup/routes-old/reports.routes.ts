import { Router, Response } from "express";
import { authenticate, AuthRequest } from '@common/middleware/auth';
import {
  ReportingService,
  ReportType,
  ReportFormat,
  ReportConfig,
} from "../services/reporting.service";

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Get available report types and formats
 * GET /reports/types
 */
router.get("/types", async (req: AuthRequest, res: Response) => {
  try {
    const reportTypes: ReportType[] = [
      "spending_summary",
      "category_breakdown",
      "card_utilization",
      "subscription_report",
      "budget_performance",
      "transaction_history",
      "monthly_trends",
      "yearly_summary",
      "cashflow_analysis",
      "merchant_analysis",
    ];

    const reportFormats: ReportFormat[] = ["pdf", "csv", "json", "excel"];

    const predefinedDateRanges = ReportingService.getPredefinedDateRanges();

    res.json({
      success: true,
      data: {
        reportTypes: reportTypes.map((type) => ({
          value: type,
          label: type
            .replace(/_/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase()),
          description: getReportTypeDescription(type),
        })),
        reportFormats: reportFormats.map((format) => ({
          value: format,
          label: format.toUpperCase(),
          description: getFormatDescription(format),
        })),
        predefinedDateRanges: Object.entries(predefinedDateRanges).map(
          ([key, range]) => ({
            value: key,
            label: key
              .replace(/_/g, " ")
              .replace(/\b\w/g, (l) => l.toUpperCase()),
            startDate: range.startDate,
            endDate: range.endDate,
          })
        ),
      },
    });
  } catch (error) {
    console.error("Error fetching report types:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch report types",
    });
  }
});

/**
 * Generate a new report
 * POST /reports/generate
 */
router.post("/generate", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { type, format, dateRange, filters, options } = req.body;

    // Validate required fields
    if (!type || !format || !dateRange) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: type, format, dateRange",
      });
    }

    // Validate date range
    if (!dateRange.startDate || !dateRange.endDate) {
      return res.status(400).json({
        success: false,
        error: "Date range must include startDate and endDate",
      });
    }

    // Validate date format and logic
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid date format. Use YYYY-MM-DD format",
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        error: "Start date must be before or equal to end date",
      });
    }

    // Create report configuration
    const config: ReportConfig = {
      type: type as ReportType,
      format: format as ReportFormat,
      dateRange: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
      userId,
      filters,
      options,
    };

    // Generate report
    const report = await ReportingService.generateReport(config);

    res.status(201).json({
      success: true,
      data: report,
      message: "Report generation started successfully",
    });
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate report",
    });
  }
});

/**
 * Get user's reports history
 * GET /reports/history
 */
router.get("/history", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const reports = await ReportingService.getUserReports(userId);

    res.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    console.error("Error fetching report history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch report history",
    });
  }
});

/**
 * Get specific report details
 * GET /reports/:id
 */
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const reportId = req.params.id;

    const report = await ReportingService.getReportById(reportId, userId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found",
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch report",
    });
  }
});

/**
 * Download a report file
 * GET /reports/:id/download
 */
router.get("/:id/download", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const reportId = req.params.id;

    const report = await ReportingService.getReportById(reportId, userId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found",
      });
    }

    if (report.status !== "completed") {
      return res.status(400).json({
        success: false,
        error: `Report is not ready for download. Status: ${report.status}`,
      });
    }

    if (!report.filePath) {
      return res.status(400).json({
        success: false,
        error: "Report file not available",
      });
    }

    // TODO: Implement file serving from storage
    // For now, return file metadata
    res.json({
      success: true,
      message: "File download functionality not yet implemented",
      data: {
        filePath: report.filePath,
        fileSize: report.fileSize,
        format: report.format,
      },
    });
  } catch (error) {
    console.error("Error downloading report:", error);
    res.status(500).json({
      success: false,
      error: "Failed to download report",
    });
  }
});

/**
 * Delete a report
 * DELETE /reports/:id
 */
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const reportId = req.params.id;

    await ReportingService.deleteReport(reportId, userId);

    res.json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete report",
    });
  }
});

/**
 * Generate quick summary report (instant, no file generation)
 * GET /reports/quick-summary
 */
router.get("/quick-summary", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { startDate, endDate, type = "spending_summary" } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "startDate and endDate are required",
      });
    }

    // Create temporary config for quick report
    const config: ReportConfig = {
      type: type as ReportType,
      format: "json",
      dateRange: {
        startDate: startDate as string,
        endDate: endDate as string,
      },
      userId,
    };

    // Generate report data directly (no file generation)
    const reportData = await (ReportingService as any).generateReportData(
      config
    );

    res.json({
      success: true,
      data: reportData,
    });
  } catch (error) {
    console.error("Error generating quick summary:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate quick summary",
    });
  }
});

/**
 * Get report templates for common use cases
 * GET /reports/templates
 */
router.get("/templates", async (req: AuthRequest, res: Response) => {
  try {
    const templates = [
      {
        id: "monthly_spending",
        name: "Monthly Spending Report",
        description: "Complete spending analysis for the current month",
        type: "spending_summary",
        format: "pdf",
        dateRange: "current_month",
        filters: {},
        options: { includeTrends: true, includeComparisons: true },
      },
      {
        id: "category_analysis",
        name: "Category Breakdown",
        description: "Detailed analysis of spending by category",
        type: "category_breakdown",
        format: "pdf",
        dateRange: "last_3_months",
        filters: {},
        options: { includeCharts: true },
      },
      {
        id: "card_comparison",
        name: "Card Usage Comparison",
        description: "Compare usage across all your credit cards",
        type: "card_utilization",
        format: "pdf",
        dateRange: "current_month",
        filters: {},
        options: { includeCharts: true },
      },
      {
        id: "subscription_audit",
        name: "Subscription Audit",
        description: "Review all active subscriptions and costs",
        type: "subscription_report",
        format: "pdf",
        dateRange: "current_month",
        filters: {},
        options: { includeComparisons: true },
      },
      {
        id: "year_end_summary",
        name: "Year-End Financial Summary",
        description: "Comprehensive financial summary for the year",
        type: "yearly_summary",
        format: "pdf",
        dateRange: "current_year",
        filters: {},
        options: {
          includeTrends: true,
          includeComparisons: true,
          includeCharts: true,
        },
      },
    ];

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error("Error fetching report templates:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch report templates",
    });
  }
});

/**
 * Generate report from template
 * POST /reports/from-template
 */
router.post("/from-template", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { templateId, customizations = {} } = req.body;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: "Template ID is required",
      });
    }

    // TODO: Get template configuration and merge with customizations
    // For now, return error for unimplemented feature
    res.status(501).json({
      success: false,
      error: "Template-based report generation not yet implemented",
    });
  } catch (error) {
    console.error("Error generating report from template:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate report from template",
    });
  }
});

/**
 * Helper function to get report type descriptions
 */
function getReportTypeDescription(type: ReportType): string {
  const descriptions: Record<ReportType, string> = {
    spending_summary:
      "Overview of total spending, earnings, and top categories/merchants",
    category_breakdown: "Detailed analysis of spending patterns by category",
    card_utilization: "Credit card usage analysis and utilization rates",
    subscription_report:
      "Analysis of all active subscriptions and recurring payments",
    budget_performance: "Performance analysis against set budgets and goals",
    transaction_history:
      "Complete list of transactions for the selected period",
    monthly_trends: "Month-over-month spending trends and patterns",
    yearly_summary: "Comprehensive annual financial summary and analysis",
    cashflow_analysis: "Income vs expenses analysis with cashflow projections",
    merchant_analysis: "Spending analysis grouped by merchants and vendors",
  };

  return descriptions[type] || "Report description not available";
}

/**
 * Helper function to get format descriptions
 */
function getFormatDescription(format: ReportFormat): string {
  const descriptions: Record<ReportFormat, string> = {
    pdf: "Professional formatted document with charts and visuals",
    csv: "Raw data in spreadsheet format for further analysis",
    json: "Structured data format for API consumption",
    excel: "Multi-sheet Excel workbook with data, charts, and summaries",
  };

  return descriptions[format] || "Format description not available";
}

export default router;
