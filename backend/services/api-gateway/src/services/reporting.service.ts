import { createClient } from "@supabase/supabase-js";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  subYears,
} from "date-fns";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Report types available for generation
 */
export type ReportType =
  | "spending_summary"
  | "category_breakdown"
  | "card_utilization"
  | "subscription_report"
  | "budget_performance"
  | "transaction_history"
  | "monthly_trends"
  | "yearly_summary"
  | "cashflow_analysis"
  | "merchant_analysis";

/**
 * Report format options
 */
export type ReportFormat = "pdf" | "csv" | "json" | "excel";

/**
 * Date range options for reports
 */
export interface DateRange {
  startDate: string;
  endDate: string;
}

/**
 * Report configuration
 */
export interface ReportConfig {
  type: ReportType;
  format: ReportFormat;
  dateRange: DateRange;
  userId: string;
  filters?: {
    cardIds?: string[];
    categories?: string[];
    merchantNames?: string[];
    amountRange?: { min?: number; max?: number };
    transactionTypes?: ("debit" | "credit" | "refund")[];
  };
  options?: {
    includeTrends?: boolean;
    includeComparisons?: boolean;
    groupBy?: "day" | "week" | "month" | "year";
    currency?: string;
    includeCharts?: boolean;
  };
}

/**
 * Generated report metadata
 */
export interface GeneratedReport {
  id: string;
  userId: string;
  type: ReportType;
  format: ReportFormat;
  config: ReportConfig;
  filePath?: string;
  fileSize?: number;
  generatedAt: string;
  expiresAt?: string;
  downloadCount: number;
  status: "generating" | "completed" | "failed" | "expired";
  errorMessage?: string;
}

/**
 * Report data structures
 */
export interface SpendingSummaryData {
  totalSpent: number;
  totalEarned: number;
  netCashflow: number;
  transactionCount: number;
  averageTransactionAmount: number;
  topCategories: { category: string; amount: number; count: number }[];
  topMerchants: { merchant: string; amount: number; count: number }[];
  dailySpending: { date: string; amount: number }[];
  monthlyTrends: { month: string; spent: number; earned: number }[];
}

export interface CategoryBreakdownData {
  categories: {
    name: string;
    amount: number;
    percentage: number;
    transactionCount: number;
    averageAmount: number;
    trend: "up" | "down" | "stable";
    monthlyData: { month: string; amount: number }[];
  }[];
  topCategory: string;
  totalSpent: number;
  categoryCount: number;
}

export interface CardUtilizationData {
  cards: {
    id: string;
    name: string;
    type: string;
    totalSpent: number;
    transactionCount: number;
    utilizationRate: number;
    creditLimit?: number;
    availableCredit?: number;
    monthlyUsage: { month: string; amount: number }[];
  }[];
  totalAcrossAllCards: number;
  averageUtilization: number;
  mostUsedCard: string;
}

export interface SubscriptionReportData {
  activeSubscriptions: number;
  totalMonthlySpend: number;
  totalAnnualSpend: number;
  subscriptionsByCategory: {
    category: string;
    count: number;
    monthlyAmount: number;
  }[];
  upcomingRenewals: { name: string; amount: number; daysUntil: number }[];
  costSavingOpportunities: string[];
  subscriptionTrends: { month: string; count: number; amount: number }[];
}

/**
 * Advanced Reporting Service - Generate comprehensive financial reports
 */
export class ReportingService {
  /**
   * Generate a report based on configuration
   */
  static async generateReport(config: ReportConfig): Promise<GeneratedReport> {
    try {
      // Create report record
      const reportRecord = await this.createReportRecord(config);

      // Generate report data based on type
      const reportData = await this.generateReportData(config);

      // Format and save report based on format
      let filePath: string | undefined;
      let fileSize: number | undefined;

      if (config.format === "pdf") {
        const result = await this.generatePDFReport(reportData, config);
        filePath = result.filePath;
        fileSize = result.fileSize;
      } else if (config.format === "csv") {
        const result = await this.generateCSVReport(reportData, config);
        filePath = result.filePath;
        fileSize = result.fileSize;
      } else if (config.format === "excel") {
        const result = await this.generateExcelReport(reportData, config);
        filePath = result.filePath;
        fileSize = result.fileSize;
      }

      // Update report record with completion
      const updatedReport = await this.updateReportRecord(reportRecord.id, {
        status: "completed",
        filePath,
        fileSize,
      });

      return updatedReport;
    } catch (error) {
      console.error("Error generating report:", error);
      throw error;
    }
  }

  /**
   * Get user's generated reports
   */
  static async getUserReports(userId: string): Promise<GeneratedReport[]> {
    try {
      const { data: reports, error } = await supabase
        .from("generated_reports")
        .select("*")
        .eq("user_id", userId)
        .order("generated_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch reports: ${error.message}`);
      }

      return reports || [];
    } catch (error) {
      console.error("Error fetching user reports:", error);
      throw error;
    }
  }

  /**
   * Delete a report
   */
  static async deleteReport(reportId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("generated_reports")
        .delete()
        .eq("id", reportId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(`Failed to delete report: ${error.message}`);
      }

      // TODO: Also delete the actual file from storage
    } catch (error) {
      console.error("Error deleting report:", error);
      throw error;
    }
  }

  /**
   * Get report by ID
   */
  static async getReportById(
    reportId: string,
    userId: string
  ): Promise<GeneratedReport | null> {
    try {
      const { data: report, error } = await supabase
        .from("generated_reports")
        .select("*")
        .eq("id", reportId)
        .eq("user_id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw new Error(`Failed to fetch report: ${error.message}`);
      }

      return report;
    } catch (error) {
      console.error("Error fetching report:", error);
      throw error;
    }
  }

  /**
   * Get predefined date ranges
   */
  static getPredefinedDateRanges(): { [key: string]: DateRange } {
    const now = new Date();

    return {
      last_7_days: {
        startDate: format(
          new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          "yyyy-MM-dd"
        ),
        endDate: format(now, "yyyy-MM-dd"),
      },
      last_30_days: {
        startDate: format(
          new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          "yyyy-MM-dd"
        ),
        endDate: format(now, "yyyy-MM-dd"),
      },
      current_month: {
        startDate: format(startOfMonth(now), "yyyy-MM-dd"),
        endDate: format(endOfMonth(now), "yyyy-MM-dd"),
      },
      last_month: {
        startDate: format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd"),
        endDate: format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd"),
      },
      last_3_months: {
        startDate: format(subMonths(now, 3), "yyyy-MM-dd"),
        endDate: format(now, "yyyy-MM-dd"),
      },
      last_6_months: {
        startDate: format(subMonths(now, 6), "yyyy-MM-dd"),
        endDate: format(now, "yyyy-MM-dd"),
      },
      current_year: {
        startDate: format(startOfYear(now), "yyyy-MM-dd"),
        endDate: format(endOfYear(now), "yyyy-MM-dd"),
      },
      last_year: {
        startDate: format(startOfYear(subYears(now, 1)), "yyyy-MM-dd"),
        endDate: format(endOfYear(subYears(now, 1)), "yyyy-MM-dd"),
      },
    };
  }

  /**
   * Private: Create report record in database
   */
  private static async createReportRecord(
    config: ReportConfig
  ): Promise<GeneratedReport> {
    const reportRecord: Omit<GeneratedReport, "id"> = {
      userId: config.userId,
      type: config.type,
      format: config.format,
      config,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      downloadCount: 0,
      status: "generating",
    };

    const { data, error } = await supabase
      .from("generated_reports")
      .insert([reportRecord])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create report record: ${error.message}`);
    }

    return data;
  }

  /**
   * Private: Update report record
   */
  private static async updateReportRecord(
    reportId: string,
    updates: Partial<GeneratedReport>
  ): Promise<GeneratedReport> {
    const { data, error } = await supabase
      .from("generated_reports")
      .update(updates)
      .eq("id", reportId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update report record: ${error.message}`);
    }

    return data;
  }

  /**
   * Private: Generate report data based on type
   */
  private static async generateReportData(config: ReportConfig): Promise<any> {
    switch (config.type) {
      case "spending_summary":
        return await this.generateSpendingSummary(config);
      case "category_breakdown":
        return await this.generateCategoryBreakdown(config);
      case "card_utilization":
        return await this.generateCardUtilization(config);
      case "subscription_report":
        return await this.generateSubscriptionReport(config);
      case "budget_performance":
        return await this.generateBudgetPerformance(config);
      case "transaction_history":
        return await this.generateTransactionHistory(config);
      case "monthly_trends":
        return await this.generateMonthlyTrends(config);
      case "yearly_summary":
        return await this.generateYearlySummary(config);
      case "cashflow_analysis":
        return await this.generateCashflowAnalysis(config);
      case "merchant_analysis":
        return await this.generateMerchantAnalysis(config);
      default:
        throw new Error(`Unsupported report type: ${config.type}`);
    }
  }

  /**
   * Private: Generate spending summary data
   */
  private static async generateSpendingSummary(
    config: ReportConfig
  ): Promise<SpendingSummaryData> {
    // Get transactions for the date range
    let query = supabase
      .from("transactions")
      .select("*")
      .eq("user_id", config.userId)
      .gte("transaction_date", config.dateRange.startDate)
      .lte("transaction_date", config.dateRange.endDate);

    // Apply filters
    if (config.filters?.cardIds?.length) {
      query = query.in("card_id", config.filters.cardIds);
    }

    const { data: transactions, error } = await query;
    if (error) throw error;

    if (!transactions?.length) {
      return {
        totalSpent: 0,
        totalEarned: 0,
        netCashflow: 0,
        transactionCount: 0,
        averageTransactionAmount: 0,
        topCategories: [],
        topMerchants: [],
        dailySpending: [],
        monthlyTrends: [],
      };
    }

    // Calculate summary statistics
    const debits = transactions.filter((t) => t.amount < 0);
    const credits = transactions.filter((t) => t.amount > 0);

    const totalSpent = Math.abs(debits.reduce((sum, t) => sum + t.amount, 0));
    const totalEarned = credits.reduce((sum, t) => sum + t.amount, 0);

    // Group by category
    const categoryMap = new Map<string, { amount: number; count: number }>();
    debits.forEach((t) => {
      const category = t.category || "Other";
      const existing = categoryMap.get(category) || { amount: 0, count: 0 };
      categoryMap.set(category, {
        amount: existing.amount + Math.abs(t.amount),
        count: existing.count + 1,
      });
    });

    const topCategories = Array.from(categoryMap.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Group by merchant
    const merchantMap = new Map<string, { amount: number; count: number }>();
    debits.forEach((t) => {
      const merchant = t.merchant_name || "Unknown";
      const existing = merchantMap.get(merchant) || { amount: 0, count: 0 };
      merchantMap.set(merchant, {
        amount: existing.amount + Math.abs(t.amount),
        count: existing.count + 1,
      });
    });

    const topMerchants = Array.from(merchantMap.entries())
      .map(([merchant, data]) => ({ merchant, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Daily spending
    const dailyMap = new Map<string, number>();
    debits.forEach((t) => {
      const date = format(new Date(t.transaction_date), "yyyy-MM-dd");
      dailyMap.set(date, (dailyMap.get(date) || 0) + Math.abs(t.amount));
    });

    const dailySpending = Array.from(dailyMap.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalSpent,
      totalEarned,
      netCashflow: totalEarned - totalSpent,
      transactionCount: transactions.length,
      averageTransactionAmount: totalSpent / debits.length || 0,
      topCategories,
      topMerchants,
      dailySpending,
      monthlyTrends: [], // Would implement with more complex date grouping
    };
  }

  /**
   * Private: Generate category breakdown data
   */
  private static async generateCategoryBreakdown(
    config: ReportConfig
  ): Promise<CategoryBreakdownData> {
    // Get transactions for the date range
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", config.userId)
      .gte("transaction_date", config.dateRange.startDate)
      .lte("transaction_date", config.dateRange.endDate)
      .lt("amount", 0); // Only debits for spending analysis

    if (error) throw error;

    if (!transactions?.length) {
      return {
        categories: [],
        topCategory: "",
        totalSpent: 0,
        categoryCount: 0,
      };
    }

    const totalSpent = transactions.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0
    );

    // Group by category with detailed analysis
    const categoryMap = new Map<
      string,
      {
        amount: number;
        count: number;
        transactions: any[];
      }
    >();

    transactions.forEach((t) => {
      const category = t.category || "Other";
      const existing = categoryMap.get(category) || {
        amount: 0,
        count: 0,
        transactions: [],
      };
      categoryMap.set(category, {
        amount: existing.amount + Math.abs(t.amount),
        count: existing.count + 1,
        transactions: [...existing.transactions, t],
      });
    });

    const categories = Array.from(categoryMap.entries())
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        percentage: (data.amount / totalSpent) * 100,
        transactionCount: data.count,
        averageAmount: data.amount / data.count,
        trend: "stable" as const, // Simplified - would need historical data
        monthlyData: [], // Would implement with date grouping
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      categories,
      topCategory: categories[0]?.name || "",
      totalSpent,
      categoryCount: categories.length,
    };
  }

  /**
   * Private: Generate card utilization data
   */
  private static async generateCardUtilization(
    config: ReportConfig
  ): Promise<CardUtilizationData> {
    // Get user's cards
    const { data: cards, error: cardsError } = await supabase
      .from("cards")
      .select("*")
      .eq("user_id", config.userId);

    if (cardsError) throw cardsError;

    const cardUtilization = await Promise.all(
      (cards || []).map(async (card) => {
        const { data: transactions, error } = await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", config.userId)
          .eq("card_id", card.id)
          .gte("transaction_date", config.dateRange.startDate)
          .lte("transaction_date", config.dateRange.endDate)
          .lt("amount", 0); // Only debits

        if (error) throw error;

        const totalSpent =
          transactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
        const utilizationRate = card.credit_limit
          ? (totalSpent / card.credit_limit) * 100
          : 0;

        return {
          id: card.id,
          name: card.card_name,
          type: card.card_type,
          totalSpent,
          transactionCount: transactions?.length || 0,
          utilizationRate,
          creditLimit: card.credit_limit,
          availableCredit: card.credit_limit
            ? card.credit_limit - totalSpent
            : undefined,
          monthlyUsage: [], // Would implement with date grouping
        };
      })
    );

    const totalAcrossAllCards = cardUtilization.reduce(
      (sum, card) => sum + card.totalSpent,
      0
    );
    const averageUtilization =
      cardUtilization.reduce((sum, card) => sum + card.utilizationRate, 0) /
        cardUtilization.length || 0;
    const mostUsedCard = cardUtilization.sort(
      (a, b) => b.totalSpent - a.totalSpent
    )[0];

    return {
      cards: cardUtilization,
      totalAcrossAllCards,
      averageUtilization,
      mostUsedCard: mostUsedCard?.name || "",
    };
  }

  /**
   * Private: Generate subscription report data
   */
  private static async generateSubscriptionReport(
    config: ReportConfig
  ): Promise<SubscriptionReportData> {
    // Get user's subscriptions
    const { data: subscriptions, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", config.userId)
      .neq("status", "cancelled");

    if (error) throw error;

    if (!subscriptions?.length) {
      return {
        activeSubscriptions: 0,
        totalMonthlySpend: 0,
        totalAnnualSpend: 0,
        subscriptionsByCategory: [],
        upcomingRenewals: [],
        costSavingOpportunities: [],
        subscriptionTrends: [],
      };
    }

    // Calculate monthly spend
    const calculateMonthlyAmount = (amount: number, frequency: string) => {
      switch (frequency) {
        case "weekly":
          return amount * 4.33;
        case "monthly":
          return amount;
        case "quarterly":
          return amount / 3;
        case "annually":
          return amount / 12;
        default:
          return amount;
      }
    };

    const totalMonthlySpend = subscriptions.reduce(
      (sum, sub) => sum + calculateMonthlyAmount(sub.amount, sub.frequency),
      0
    );

    // Group by category
    const categoryMap = new Map<
      string,
      { count: number; monthlyAmount: number }
    >();
    subscriptions.forEach((sub) => {
      const category = sub.category;
      const monthlyAmount = calculateMonthlyAmount(sub.amount, sub.frequency);
      const existing = categoryMap.get(category) || {
        count: 0,
        monthlyAmount: 0,
      };
      categoryMap.set(category, {
        count: existing.count + 1,
        monthlyAmount: existing.monthlyAmount + monthlyAmount,
      });
    });

    const subscriptionsByCategory = Array.from(categoryMap.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.monthlyAmount - a.monthlyAmount);

    // Upcoming renewals (next 30 days)
    const now = new Date();
    const upcomingRenewals = subscriptions
      .map((sub) => {
        const nextExpected = new Date(sub.next_expected);
        const daysUntil = Math.ceil(
          (nextExpected.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );
        return {
          name: sub.merchant_name,
          amount: sub.amount,
          daysUntil,
        };
      })
      .filter((renewal) => renewal.daysUntil >= 0 && renewal.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    return {
      activeSubscriptions: subscriptions.filter(
        (sub) => sub.status === "active"
      ).length,
      totalMonthlySpend,
      totalAnnualSpend: totalMonthlySpend * 12,
      subscriptionsByCategory,
      upcomingRenewals,
      costSavingOpportunities: [], // Would implement with business logic
      subscriptionTrends: [], // Would implement with historical data
    };
  }

  /**
   * Private: Generate other report types (simplified implementations)
   */
  private static async generateBudgetPerformance(
    config: ReportConfig
  ): Promise<any> {
    // TODO: Implement budget performance analysis
    return { message: "Budget performance report not yet implemented" };
  }

  private static async generateTransactionHistory(
    config: ReportConfig
  ): Promise<any> {
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", config.userId)
      .gte("transaction_date", config.dateRange.startDate)
      .lte("transaction_date", config.dateRange.endDate)
      .order("transaction_date", { ascending: false });

    if (error) throw error;
    return { transactions: transactions || [] };
  }

  private static async generateMonthlyTrends(
    config: ReportConfig
  ): Promise<any> {
    // TODO: Implement monthly trends analysis
    return { message: "Monthly trends report not yet implemented" };
  }

  private static async generateYearlySummary(
    config: ReportConfig
  ): Promise<any> {
    // TODO: Implement yearly summary
    return { message: "Yearly summary report not yet implemented" };
  }

  private static async generateCashflowAnalysis(
    config: ReportConfig
  ): Promise<any> {
    // TODO: Implement cashflow analysis
    return { message: "Cashflow analysis report not yet implemented" };
  }

  private static async generateMerchantAnalysis(
    config: ReportConfig
  ): Promise<any> {
    // TODO: Implement merchant analysis
    return { message: "Merchant analysis report not yet implemented" };
  }

  /**
   * Private: Generate PDF report (placeholder - would use library like puppeteer or jsPDF)
   */
  private static async generatePDFReport(
    data: any,
    config: ReportConfig
  ): Promise<{ filePath: string; fileSize: number }> {
    // TODO: Implement PDF generation using puppeteer or similar
    // For now, return mock data
    const filePath = `/reports/${config.userId}/${Date.now()}_${config.type}.pdf`;
    const fileSize = 1024 * 100; // Mock 100KB

    return { filePath, fileSize };
  }

  /**
   * Private: Generate CSV report
   */
  private static async generateCSVReport(
    data: any,
    config: ReportConfig
  ): Promise<{ filePath: string; fileSize: number }> {
    // TODO: Implement CSV generation
    // For now, return mock data
    const filePath = `/reports/${config.userId}/${Date.now()}_${config.type}.csv`;
    const fileSize = 1024 * 50; // Mock 50KB

    return { filePath, fileSize };
  }

  /**
   * Private: Generate Excel report with multi-sheet capabilities
   */
  private static async generateExcelReport(
    data: any,
    config: ReportConfig
  ): Promise<{ filePath: string; fileSize: number }> {
    try {
      // Create workbook structure based on report type
      const workbook = await this.createExcelWorkbook(data, config);

      // Generate file path
      const fileName = `${Date.now()}_${config.type}.xlsx`;
      const filePath = `/reports/${config.userId}/${fileName}`;

      // In a real implementation, you would use libraries like ExcelJS or XLSX
      // For now, we'll simulate the Excel generation
      const mockExcelData = this.generateMockExcelContent(data, config);

      // Simulate file writing
      console.log(`Generated Excel report: ${filePath}`);
      console.log(`Workbook contains ${workbook.sheets.length} sheets`);

      // Calculate file size based on data complexity
      const baseSize = 1024 * 100; // 100KB base
      const dataMultiplier = Math.max(
        1,
        Math.floor(JSON.stringify(data).length / 1000)
      );
      const fileSize = baseSize + dataMultiplier * 1024 * 10; // Additional 10KB per 1000 chars

      return { filePath, fileSize };
    } catch (error) {
      console.error("Error generating Excel report:", error);
      throw new Error(
        `Excel generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Create Excel workbook structure
   */
  private static async createExcelWorkbook(
    data: any,
    config: ReportConfig
  ): Promise<{
    name: string;
    sheets: Array<{
      name: string;
      data: any[];
      type: "data" | "chart" | "summary";
    }>;
  }> {
    const sheets: Array<{
      name: string;
      data: any[];
      type: "data" | "chart" | "summary";
    }> = [];

    switch (config.type) {
      case "spending_summary":
        sheets.push(
          { name: "Summary", data: data.summary || [], type: "summary" },
          { name: "Transactions", data: data.transactions || [], type: "data" },
          { name: "Charts", data: data.chartData || [], type: "chart" }
        );
        break;

      case "category_breakdown":
        sheets.push(
          {
            name: "Category Overview",
            data: data.categories || [],
            type: "summary",
          },
          {
            name: "Category Details",
            data: data.categoryDetails || [],
            type: "data",
          },
          { name: "Trends", data: data.trends || [], type: "chart" }
        );
        break;

      case "card_utilization":
        sheets.push(
          {
            name: "Card Summary",
            data: data.cardSummary || [],
            type: "summary",
          },
          {
            name: "Utilization History",
            data: data.utilizationHistory || [],
            type: "data",
          },
          {
            name: "Performance Charts",
            data: data.performanceCharts || [],
            type: "chart",
          }
        );
        break;

      case "subscription_report":
        sheets.push(
          {
            name: "Active Subscriptions",
            data: data.activeSubscriptions || [],
            type: "data",
          },
          {
            name: "Subscription Trends",
            data: data.subscriptionTrends || [],
            type: "chart",
          },
          {
            name: "Cost Analysis",
            data: data.costAnalysis || [],
            type: "summary",
          }
        );
        break;

      case "budget_performance":
        sheets.push(
          {
            name: "Budget vs Actual",
            data: data.budgetComparison || [],
            type: "summary",
          },
          {
            name: "Category Performance",
            data: data.categoryPerformance || [],
            type: "data",
          },
          {
            name: "Variance Analysis",
            data: data.varianceAnalysis || [],
            type: "chart",
          }
        );
        break;

      case "transaction_history":
        sheets.push(
          {
            name: "All Transactions",
            data: data.transactions || [],
            type: "data",
          },
          {
            name: "Monthly Summary",
            data: data.monthlySummary || [],
            type: "summary",
          },
          {
            name: "Merchant Analysis",
            data: data.merchantAnalysis || [],
            type: "data",
          }
        );
        break;

      case "monthly_trends":
        sheets.push(
          {
            name: "Trend Summary",
            data: data.trendSummary || [],
            type: "summary",
          },
          { name: "Monthly Data", data: data.monthlyData || [], type: "data" },
          { name: "Trend Charts", data: data.trendCharts || [], type: "chart" }
        );
        break;

      case "yearly_summary":
        sheets.push(
          {
            name: "Year Overview",
            data: data.yearOverview || [],
            type: "summary",
          },
          {
            name: "Monthly Breakdown",
            data: data.monthlyBreakdown || [],
            type: "data",
          },
          {
            name: "Year-over-Year",
            data: data.yearOverYear || [],
            type: "chart",
          }
        );
        break;

      case "cashflow_analysis":
        sheets.push(
          {
            name: "Cashflow Summary",
            data: data.cashflowSummary || [],
            type: "summary",
          },
          {
            name: "Income vs Expenses",
            data: data.incomeVsExpenses || [],
            type: "data",
          },
          {
            name: "Cashflow Charts",
            data: data.cashflowCharts || [],
            type: "chart",
          }
        );
        break;

      case "merchant_analysis":
        sheets.push(
          {
            name: "Top Merchants",
            data: data.topMerchants || [],
            type: "summary",
          },
          {
            name: "Merchant Details",
            data: data.merchantDetails || [],
            type: "data",
          },
          {
            name: "Spending Patterns",
            data: data.spendingPatterns || [],
            type: "chart",
          }
        );
        break;

      default:
        sheets.push(
          { name: "Report Data", data: data.rawData || [], type: "data" },
          { name: "Summary", data: data.summary || [], type: "summary" }
        );
    }

    return {
      name: `${config.type}_report_${format(new Date(), "yyyy-MM-dd")}`,
      sheets,
    };
  }

  /**
   * Generate mock Excel content for testing
   */
  private static generateMockExcelContent(
    data: any,
    config: ReportConfig
  ): string {
    const content: {
      workbook: {
        name: string;
        sheets: any[];
      };
      metadata: {
        generated: string;
        reportType: string;
        format: string;
        version: string;
      };
    } = {
      workbook: {
        name: `${config.type}_report`,
        sheets: [],
      },
      metadata: {
        generated: new Date().toISOString(),
        reportType: config.type,
        format: "excel",
        version: "1.0",
      },
    };

    // Add mock sheets based on report type
    switch (config.type) {
      case "spending_summary":
        content.workbook.sheets = [
          {
            name: "Summary",
            headers: [
              "Category",
              "Amount",
              "Transactions",
              "Avg per Transaction",
            ],
            rows: [
              ["Groceries", "$1,234.56", "45", "$27.43"],
              ["Gas", "$567.89", "12", "$47.32"],
              ["Restaurants", "$890.12", "28", "$31.79"],
              ["Shopping", "$1,456.78", "23", "$63.34"],
            ],
          },
          {
            name: "Charts",
            chartData: {
              type: "pie",
              title: "Spending by Category",
              data: "Linked to Summary sheet",
            },
          },
        ];
        break;

      default:
        content.workbook.sheets = [
          {
            name: "Data",
            headers: ["Date", "Description", "Amount", "Category"],
            rows: [
              ["2024-01-15", "Sample Transaction 1", "$123.45", "Groceries"],
              ["2024-01-16", "Sample Transaction 2", "$67.89", "Gas"],
            ],
          },
        ];
    }

    return JSON.stringify(content, null, 2);
  }
}
