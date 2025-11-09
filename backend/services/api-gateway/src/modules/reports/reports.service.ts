import { supabase } from "shared/database/supabase";
import { logger } from "shared/monitoring/logger";
import { AppError } from "shared/errors/AppError";

// Helper functions to replace date-fns
function format(date: Date, formatStr: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (formatStr === "yyyy-MM-dd") {
    return `${year}-${month}-${day}`;
  }
  return date.toISOString();
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31);
}

function subMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
}

function subYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() - years);
  return result;
}

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
      logger.error("Error generating report", error as Error);
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
      logger.error("Error fetching user reports", error as Error);
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

      // Delete the actual file from storage if filePath exists
      const report = await this.getReportByIdInternal(reportId, userId);
      if (report?.filePath) {
        try {
          // In a real implementation, delete from storage service (S3, etc.)
          // For now, log the deletion
          logger.info(`Would delete file: ${report.filePath}`);
          // Example: await storageService.deleteFile(report.filePath);
        } catch (fileError) {
          logger.error("Error deleting report file", fileError as Error);
          // Don't fail the whole operation if file deletion fails
        }
      }
    } catch (error) {
      logger.error("Error deleting report", error as Error);
      throw error;
    }
  }

  /**
   * Get report by ID
   */
  static async getReportByIdInternal(
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
      logger.error("Error fetching report", error as Error);
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
        startDate: format(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
        endDate: format(now, "yyyy-MM-dd"),
      },
      last_30_days: {
        startDate: format(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
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
  private static async createReportRecord(config: ReportConfig): Promise<GeneratedReport> {
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
  private static async generateSpendingSummary(config: ReportConfig): Promise<SpendingSummaryData> {
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

    const totalSpent = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

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
  private static async generateCardUtilization(config: ReportConfig): Promise<CardUtilizationData> {
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

        const totalSpent = transactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
        const utilizationRate = card.credit_limit ? (totalSpent / card.credit_limit) * 100 : 0;

        return {
          id: card.id,
          name: card.card_name,
          type: card.card_type,
          totalSpent,
          transactionCount: transactions?.length || 0,
          utilizationRate,
          creditLimit: card.credit_limit,
          availableCredit: card.credit_limit ? card.credit_limit - totalSpent : undefined,
          monthlyUsage: [], // Would implement with date grouping
        };
      })
    );

    const totalAcrossAllCards = cardUtilization.reduce((sum, card) => sum + card.totalSpent, 0);
    const averageUtilization =
      cardUtilization.reduce((sum, card) => sum + card.utilizationRate, 0) /
        cardUtilization.length || 0;
    const mostUsedCard = cardUtilization.sort((a, b) => b.totalSpent - a.totalSpent)[0];

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
    const categoryMap = new Map<string, { count: number; monthlyAmount: number }>();
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
      activeSubscriptions: subscriptions.filter((sub) => sub.status === "active").length,
      totalMonthlySpend,
      totalAnnualSpend: totalMonthlySpend * 12,
      subscriptionsByCategory,
      upcomingRenewals,
      costSavingOpportunities: [], // Would implement with business logic
      subscriptionTrends: [], // Would implement with historical data
    };
  }

  /**
   * Private: Generate budget performance analysis
   */
  private static async generateBudgetPerformance(config: ReportConfig): Promise<any> {
    try {
      // Get budgets for the user
      const { data: budgets, error: budgetsError } = await supabase
        .from("budgets")
        .select("*")
        .eq("user_id", config.userId);

      if (budgetsError) throw budgetsError;

      if (!budgets || budgets.length === 0) {
        return {
          budgets: [],
          totalBudget: 0,
          totalSpent: 0,
          totalRemaining: 0,
          overallPerformance: 0,
          categoryPerformance: [],
        };
      }

      // Get transactions for budget categories in date range
      const { data: transactions, error: transError } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", config.userId)
        .gte("transaction_date", config.dateRange.startDate)
        .lte("transaction_date", config.dateRange.endDate)
        .lt("amount", 0); // Only debits

      if (transError) throw transError;

      // Calculate performance for each budget
      const categoryPerformance = budgets.map((budget) => {
        const categoryTransactions = (transactions || []).filter(
          (t) => t.category === budget.category
        );

        const spent = categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const remaining = budget.amount - spent;
        const percentageUsed = (spent / budget.amount) * 100;
        const status =
          percentageUsed >= 100
            ? "over_budget"
            : percentageUsed >= 90
              ? "warning"
              : percentageUsed >= 75
                ? "caution"
                : "on_track";

        return {
          category: budget.category,
          budgetAmount: budget.amount,
          spent,
          remaining,
          percentageUsed,
          status,
          transactionCount: categoryTransactions.length,
          period: budget.period,
        };
      });

      const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
      const totalSpent = categoryPerformance.reduce((sum, p) => sum + p.spent, 0);
      const totalRemaining = totalBudget - totalSpent;
      const overallPerformance = (totalSpent / totalBudget) * 100;

      return {
        budgets: categoryPerformance,
        totalBudget,
        totalSpent,
        totalRemaining,
        overallPerformance,
        categoryPerformance: categoryPerformance.sort(
          (a, b) => b.percentageUsed - a.percentageUsed
        ),
        dateRange: config.dateRange,
      };
    } catch (error) {
      logger.error("Error generating budget performance report", error as Error);
      throw error;
    }
  }

  private static async generateTransactionHistory(config: ReportConfig): Promise<any> {
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

  private static async generateMonthlyTrends(config: ReportConfig): Promise<any> {
    try {
      // Get transactions for extended period to show trends
      const extendedStartDate = format(
        subMonths(new Date(config.dateRange.startDate), 6),
        "yyyy-MM-dd"
      );

      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", config.userId)
        .gte("transaction_date", extendedStartDate)
        .lte("transaction_date", config.dateRange.endDate)
        .order("transaction_date", { ascending: true });

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        return {
          months: [],
          averageMonthlyIncome: 0,
          averageMonthlySpending: 0,
          trend: "stable",
          growthRate: 0,
        };
      }

      // Group transactions by month
      const monthlyData = new Map<
        string,
        { income: number; spending: number; transactions: number }
      >();

      transactions.forEach((t) => {
        const date = new Date(t.transaction_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        const existing = monthlyData.get(monthKey) || { income: 0, spending: 0, transactions: 0 };

        if (t.amount > 0) {
          existing.income += t.amount;
        } else {
          existing.spending += Math.abs(t.amount);
        }
        existing.transactions += 1;

        monthlyData.set(monthKey, existing);
      });

      // Convert to array and calculate trends
      const months = Array.from(monthlyData.entries())
        .map(([month, data]) => ({
          month,
          income: data.income,
          spending: data.spending,
          netCashflow: data.income - data.spending,
          transactions: data.transactions,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      const totalIncome = months.reduce((sum, m) => sum + m.income, 0);
      const totalSpending = months.reduce((sum, m) => sum + m.spending, 0);
      const averageMonthlyIncome = totalIncome / months.length;
      const averageMonthlySpending = totalSpending / months.length;

      // Calculate growth rate (last month vs first month)
      let growthRate = 0;
      let trend: "increasing" | "decreasing" | "stable" = "stable";

      if (months.length >= 2) {
        const firstMonth = months[0].spending;
        const lastMonth = months[months.length - 1].spending;

        if (firstMonth > 0) {
          growthRate = ((lastMonth - firstMonth) / firstMonth) * 100;

          if (growthRate > 5) trend = "increasing";
          else if (growthRate < -5) trend = "decreasing";
        }
      }

      return {
        months,
        averageMonthlyIncome,
        averageMonthlySpending,
        trend,
        growthRate,
        totalMonths: months.length,
      };
    } catch (error) {
      logger.error("Error generating monthly trends report", error as Error);
      throw error;
    }
  }

  private static async generateYearlySummary(config: ReportConfig): Promise<any> {
    try {
      const year = new Date(config.dateRange.startDate).getFullYear();
      const yearStart = format(startOfYear(new Date(year, 0, 1)), "yyyy-MM-dd");
      const yearEnd = format(endOfYear(new Date(year, 11, 31)), "yyyy-MM-dd");

      // Get all transactions for the year
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", config.userId)
        .gte("transaction_date", yearStart)
        .lte("transaction_date", yearEnd);

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        return {
          year,
          totalIncome: 0,
          totalSpending: 0,
          netSavings: 0,
          transactionCount: 0,
          monthlyBreakdown: [],
          topCategories: [],
          topMerchants: [],
        };
      }

      const income = transactions.filter((t) => t.amount > 0);
      const spending = transactions.filter((t) => t.amount < 0);

      const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
      const totalSpending = Math.abs(spending.reduce((sum, t) => sum + t.amount, 0));
      const netSavings = totalIncome - totalSpending;

      // Monthly breakdown
      const monthlyData = new Map<
        number,
        { income: number; spending: number; transactions: number }
      >();

      transactions.forEach((t) => {
        const month = new Date(t.transaction_date).getMonth();
        const existing = monthlyData.get(month) || { income: 0, spending: 0, transactions: 0 };

        if (t.amount > 0) {
          existing.income += t.amount;
        } else {
          existing.spending += Math.abs(t.amount);
        }
        existing.transactions += 1;

        monthlyData.set(month, existing);
      });

      const monthlyBreakdown = Array.from(monthlyData.entries())
        .map(([month, data]) => ({
          month: new Date(year, month, 1).toLocaleString("default", { month: "long" }),
          monthNumber: month + 1,
          ...data,
        }))
        .sort((a, b) => a.monthNumber - b.monthNumber);

      // Top categories
      const categoryMap = new Map<string, number>();
      spending.forEach((t) => {
        const category = t.category || "Other";
        categoryMap.set(category, (categoryMap.get(category) || 0) + Math.abs(t.amount));
      });

      const topCategories = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      // Top merchants
      const merchantMap = new Map<string, number>();
      spending.forEach((t) => {
        const merchant = t.merchant_name || "Unknown";
        merchantMap.set(merchant, (merchantMap.get(merchant) || 0) + Math.abs(t.amount));
      });

      const topMerchants = Array.from(merchantMap.entries())
        .map(([merchant, amount]) => ({ merchant, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      return {
        year,
        totalIncome,
        totalSpending,
        netSavings,
        savingsRate: totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0,
        transactionCount: transactions.length,
        monthlyBreakdown,
        topCategories,
        topMerchants,
        averageMonthlySpending: totalSpending / 12,
        averageMonthlyIncome: totalIncome / 12,
      };
    } catch (error) {
      logger.error("Error generating yearly summary report", error as Error);
      throw error;
    }
  }

  private static async generateCashflowAnalysis(config: ReportConfig): Promise<any> {
    try {
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", config.userId)
        .gte("transaction_date", config.dateRange.startDate)
        .lte("transaction_date", config.dateRange.endDate)
        .order("transaction_date", { ascending: true });

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        return {
          totalInflow: 0,
          totalOutflow: 0,
          netCashflow: 0,
          dailyCashflow: [],
          monthlyCashflow: [],
          cashflowTrend: "stable",
        };
      }

      const inflows = transactions.filter((t) => t.amount > 0);
      const outflows = transactions.filter((t) => t.amount < 0);

      const totalInflow = inflows.reduce((sum, t) => sum + t.amount, 0);
      const totalOutflow = Math.abs(outflows.reduce((sum, t) => sum + t.amount, 0));
      const netCashflow = totalInflow - totalOutflow;

      // Daily cashflow
      const dailyMap = new Map<string, { inflow: number; outflow: number }>();

      transactions.forEach((t) => {
        const date = format(new Date(t.transaction_date), "yyyy-MM-dd");
        const existing = dailyMap.get(date) || { inflow: 0, outflow: 0 };

        if (t.amount > 0) {
          existing.inflow += t.amount;
        } else {
          existing.outflow += Math.abs(t.amount);
        }

        dailyMap.set(date, existing);
      });

      const dailyCashflow = Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date,
          inflow: data.inflow,
          outflow: data.outflow,
          net: data.inflow - data.outflow,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Monthly cashflow
      const monthlyMap = new Map<string, { inflow: number; outflow: number }>();

      transactions.forEach((t) => {
        const date = new Date(t.transaction_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const existing = monthlyMap.get(monthKey) || { inflow: 0, outflow: 0 };

        if (t.amount > 0) {
          existing.inflow += t.amount;
        } else {
          existing.outflow += Math.abs(t.amount);
        }

        monthlyMap.set(monthKey, existing);
      });

      const monthlyCashflow = Array.from(monthlyMap.entries())
        .map(([month, data]) => ({
          month,
          inflow: data.inflow,
          outflow: data.outflow,
          net: data.inflow - data.outflow,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // Determine trend
      let cashflowTrend: "improving" | "declining" | "stable" = "stable";

      if (monthlyCashflow.length >= 2) {
        const firstMonthNet = monthlyCashflow[0].net;
        const lastMonthNet = monthlyCashflow[monthlyCashflow.length - 1].net;

        const change = lastMonthNet - firstMonthNet;
        const changePercent = firstMonthNet !== 0 ? (change / Math.abs(firstMonthNet)) * 100 : 0;

        if (changePercent > 10) cashflowTrend = "improving";
        else if (changePercent < -10) cashflowTrend = "declining";
      }

      return {
        totalInflow,
        totalOutflow,
        netCashflow,
        dailyCashflow,
        monthlyCashflow,
        cashflowTrend,
        averageDailyInflow: totalInflow / dailyCashflow.length,
        averageDailyOutflow: totalOutflow / dailyCashflow.length,
      };
    } catch (error) {
      logger.error("Error generating cashflow analysis report", error as Error);
      throw error;
    }
  }

  private static async generateMerchantAnalysis(config: ReportConfig): Promise<any> {
    try {
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", config.userId)
        .gte("transaction_date", config.dateRange.startDate)
        .lte("transaction_date", config.dateRange.endDate)
        .lt("amount", 0); // Only spending transactions

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        return {
          totalMerchants: 0,
          topMerchants: [],
          merchantsByCategory: [],
          totalSpent: 0,
        };
      }

      const totalSpent = Math.abs(transactions.reduce((sum, t) => sum + t.amount, 0));

      // Group by merchant
      const merchantMap = new Map<
        string,
        {
          totalSpent: number;
          transactionCount: number;
          averageTransaction: number;
          category: string;
          transactions: any[];
        }
      >();

      transactions.forEach((t) => {
        const merchant = t.merchant_name || "Unknown";
        const existing = merchantMap.get(merchant) || {
          totalSpent: 0,
          transactionCount: 0,
          averageTransaction: 0,
          category: t.category || "Other",
          transactions: [],
        };

        existing.totalSpent += Math.abs(t.amount);
        existing.transactionCount += 1;
        existing.transactions.push(t);

        merchantMap.set(merchant, existing);
      });

      // Calculate averages and sort
      const merchantAnalysis = Array.from(merchantMap.entries()).map(([merchant, data]) => ({
        merchant,
        totalSpent: data.totalSpent,
        transactionCount: data.transactionCount,
        averageTransaction: data.totalSpent / data.transactionCount,
        category: data.category,
        percentageOfTotal: (data.totalSpent / totalSpent) * 100,
        frequency: data.transactionCount,
      }));

      const topMerchants = merchantAnalysis
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 20);

      // Group merchants by category
      const categoryMap = new Map<string, { merchants: number; totalSpent: number }>();

      merchantAnalysis.forEach((m) => {
        const existing = categoryMap.get(m.category) || { merchants: 0, totalSpent: 0 };
        existing.merchants += 1;
        existing.totalSpent += m.totalSpent;
        categoryMap.set(m.category, existing);
      });

      const merchantsByCategory = Array.from(categoryMap.entries())
        .map(([category, data]) => ({
          category,
          merchantCount: data.merchants,
          totalSpent: data.totalSpent,
          percentageOfTotal: (data.totalSpent / totalSpent) * 100,
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent);

      return {
        totalMerchants: merchantMap.size,
        topMerchants,
        merchantsByCategory,
        totalSpent,
        averagePerMerchant: totalSpent / merchantMap.size,
        mostFrequentMerchant:
          topMerchants.sort((a, b) => b.frequency - a.frequency)[0]?.merchant || "N/A",
      };
    } catch (error) {
      logger.error("Error generating merchant analysis report", error as Error);
      throw error;
    }
  }

  /**
   * Private: Generate PDF report
   * Uses a lightweight approach suitable for zero-cost architecture
   */
  private static async generatePDFReport(
    data: any,
    config: ReportConfig
  ): Promise<{ filePath: string; fileSize: number }> {
    try {
      // Generate HTML content for PDF
      const htmlContent = this.generatePDFHTML(data, config);

      // In a real implementation, you would use puppeteer or similar:
      // const browser = await puppeteer.launch({ headless: true });
      // const page = await browser.newPage();
      // await page.setContent(htmlContent);
      // const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      // await browser.close();
      //
      // Upload to storage and get URL
      // const filePath = await storageService.uploadFile(pdfBuffer, `reports/${config.userId}/${Date.now()}_${config.type}.pdf`);

      // For zero-cost architecture, we'll simulate the PDF generation
      const fileName = `${Date.now()}_${config.type}.pdf`;
      const filePath = `/reports/${config.userId}/${fileName}`;

      // Calculate estimated file size based on content
      const contentSize = htmlContent.length;
      const fileSize = Math.max(1024 * 50, contentSize * 2); // Minimum 50KB

      logger.info(`Generated PDF report: ${filePath} (${fileSize} bytes)`);

      return { filePath, fileSize };
    } catch (error) {
      logger.error("Error generating PDF report", error as Error);
      throw new Error(
        `PDF generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Generate HTML content for PDF
   */
  private static generatePDFHTML(data: any, config: ReportConfig): string {
    const title = config.type.replace(/_/g, " ").toUpperCase();
    const date = new Date().toLocaleDateString();

    let contentHTML = "";

    // Generate content based on report type
    switch (config.type) {
      case "spending_summary":
        contentHTML = `
          <h2>Spending Summary</h2>
          <div class="summary">
            <p><strong>Total Spent:</strong> ₹${data.totalSpent?.toFixed(2) || 0}</p>
            <p><strong>Total Earned:</strong> ₹${data.totalEarned?.toFixed(2) || 0}</p>
            <p><strong>Net Cashflow:</strong> ₹${data.netCashflow?.toFixed(2) || 0}</p>
            <p><strong>Transaction Count:</strong> ${data.transactionCount || 0}</p>
          </div>
          <h3>Top Categories</h3>
          <table>
            <thead><tr><th>Category</th><th>Amount</th><th>Count</th></tr></thead>
            <tbody>
              ${(data.topCategories || [])
                .map(
                  (cat: any) => `
                <tr><td>${cat.category}</td><td>₹${cat.amount.toFixed(2)}</td><td>${cat.count}</td></tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        `;
        break;

      default:
        contentHTML = `
          <h2>${title}</h2>
          <div class="summary">
            <p>Report data generated for period: ${config.dateRange.startDate} to ${config.dateRange.endDate}</p>
            <pre>${JSON.stringify(data, null, 2)}</pre>
          </div>
        `;
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${title} Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
            h2 { color: #555; margin-top: 30px; }
            .summary { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #007bff; color: white; }
            tr:hover { background: #f5f5f5; }
            .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <h1>${title} Report</h1>
          <p><strong>Generated:</strong> ${date}</p>
          <p><strong>Period:</strong> ${config.dateRange.startDate} to ${config.dateRange.endDate}</p>
          ${contentHTML}
          <div class="footer">
            <p>Credit Card Dashboard - Financial Reports</p>
            <p>This report is confidential and intended for the recipient only.</p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Private: Generate CSV report
   */
  private static async generateCSVReport(
    data: any,
    config: ReportConfig
  ): Promise<{ filePath: string; fileSize: number }> {
    try {
      // Generate CSV content based on report type
      const csvContent = this.generateCSVContent(data, config);

      // In a real implementation, you would:
      // const csvBuffer = Buffer.from(csvContent);
      // const filePath = await storageService.uploadFile(csvBuffer, `reports/${config.userId}/${Date.now()}_${config.type}.csv`);

      // For zero-cost architecture, we'll simulate the CSV generation
      const fileName = `${Date.now()}_${config.type}.csv`;
      const filePath = `/reports/${config.userId}/${fileName}`;
      const fileSize = Buffer.byteLength(csvContent, "utf8");

      logger.info(`Generated CSV report: ${filePath} (${fileSize} bytes)`);

      return { filePath, fileSize };
    } catch (error) {
      logger.error("Error generating CSV report", error as Error);
      throw new Error(
        `CSV generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Generate CSV content for different report types
   */
  private static generateCSVContent(data: any, config: ReportConfig): string {
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const arrayToCSV = (headers: string[], rows: any[][]): string => {
      const headerLine = headers.map(escapeCSV).join(",");
      const dataLines = rows.map((row) => row.map(escapeCSV).join(",")).join("\n");
      return `${headerLine}\n${dataLines}`;
    };

    let csvContent = "";

    // Generate content based on report type
    switch (config.type) {
      case "spending_summary":
        csvContent = arrayToCSV(
          ["Metric", "Value"],
          [
            ["Total Spent", data.totalSpent?.toFixed(2) || "0"],
            ["Total Earned", data.totalEarned?.toFixed(2) || "0"],
            ["Net Cashflow", data.netCashflow?.toFixed(2) || "0"],
            ["Transaction Count", data.transactionCount || "0"],
          ]
        );
        if (data.topCategories && data.topCategories.length > 0) {
          csvContent += "\n\nTop Categories\n";
          csvContent += arrayToCSV(
            ["Category", "Amount", "Count"],
            data.topCategories.map((cat: any) => [cat.category, cat.amount.toFixed(2), cat.count])
          );
        }
        break;

      case "transaction_history":
        if (data.transactions && Array.isArray(data.transactions)) {
          csvContent = arrayToCSV(
            ["Date", "Description", "Amount", "Category", "Merchant", "Card ID"],
            data.transactions.map((t: any) => [
              t.transaction_date || "",
              t.description || "",
              t.amount?.toFixed(2) || "0",
              t.category || "",
              t.merchant_name || "",
              t.card_id || "",
            ])
          );
        }
        break;

      case "monthly_trends":
        if (data.months && Array.isArray(data.months)) {
          csvContent = arrayToCSV(
            ["Month", "Income", "Spending", "Net Cashflow", "Transactions"],
            data.months.map((m: any) => [
              m.month,
              m.income?.toFixed(2) || "0",
              m.spending?.toFixed(2) || "0",
              m.netCashflow?.toFixed(2) || "0",
              m.transactions || "0",
            ])
          );
        }
        break;

      case "yearly_summary":
        csvContent = arrayToCSV(
          ["Metric", "Value"],
          [
            ["Year", data.year || ""],
            ["Total Income", data.totalIncome?.toFixed(2) || "0"],
            ["Total Spending", data.totalSpending?.toFixed(2) || "0"],
            ["Net Savings", data.netSavings?.toFixed(2) || "0"],
            ["Savings Rate (%)", data.savingsRate?.toFixed(2) || "0"],
            ["Transaction Count", data.transactionCount || "0"],
          ]
        );
        if (data.monthlyBreakdown && data.monthlyBreakdown.length > 0) {
          csvContent += "\n\nMonthly Breakdown\n";
          csvContent += arrayToCSV(
            ["Month", "Income", "Spending", "Transactions"],
            data.monthlyBreakdown.map((m: any) => [
              m.month,
              m.income?.toFixed(2) || "0",
              m.spending?.toFixed(2) || "0",
              m.transactions || "0",
            ])
          );
        }
        break;

      case "merchant_analysis":
        if (data.topMerchants && Array.isArray(data.topMerchants)) {
          csvContent = arrayToCSV(
            [
              "Merchant",
              "Total Spent",
              "Transaction Count",
              "Average Transaction",
              "Category",
              "Percentage of Total",
            ],
            data.topMerchants.map((m: any) => [
              m.merchant,
              m.totalSpent?.toFixed(2) || "0",
              m.transactionCount || "0",
              m.averageTransaction?.toFixed(2) || "0",
              m.category || "",
              m.percentageOfTotal?.toFixed(2) || "0",
            ])
          );
        }
        break;

      case "budget_performance":
        if (data.budgets && Array.isArray(data.budgets)) {
          csvContent = arrayToCSV(
            [
              "Category",
              "Budget Amount",
              "Spent",
              "Remaining",
              "Percentage Used",
              "Status",
              "Transaction Count",
            ],
            data.budgets.map((b: any) => [
              b.category,
              b.budgetAmount?.toFixed(2) || "0",
              b.spent?.toFixed(2) || "0",
              b.remaining?.toFixed(2) || "0",
              b.percentageUsed?.toFixed(2) || "0",
              b.status || "",
              b.transactionCount || "0",
            ])
          );
        }
        break;

      case "cashflow_analysis":
        csvContent = arrayToCSV(
          ["Metric", "Value"],
          [
            ["Total Inflow", data.totalInflow?.toFixed(2) || "0"],
            ["Total Outflow", data.totalOutflow?.toFixed(2) || "0"],
            ["Net Cashflow", data.netCashflow?.toFixed(2) || "0"],
            ["Cashflow Trend", data.cashflowTrend || ""],
          ]
        );
        if (data.monthlyCashflow && data.monthlyCashflow.length > 0) {
          csvContent += "\n\nMonthly Cashflow\n";
          csvContent += arrayToCSV(
            ["Month", "Inflow", "Outflow", "Net"],
            data.monthlyCashflow.map((m: any) => [
              m.month,
              m.inflow?.toFixed(2) || "0",
              m.outflow?.toFixed(2) || "0",
              m.net?.toFixed(2) || "0",
            ])
          );
        }
        break;

      default:
        // Generic fallback - convert data to JSON-like CSV
        csvContent = `Report Type,${config.type}\nGenerated,${new Date().toISOString()}\n\nData\n${JSON.stringify(data, null, 2)}`;
    }

    // Add report metadata header
    const metadata = [
      `# ${config.type.replace(/_/g, " ").toUpperCase()} REPORT`,
      `# Generated: ${new Date().toISOString()}`,
      `# Period: ${config.dateRange.startDate} to ${config.dateRange.endDate}`,
      `# User ID: ${config.userId}`,
      "",
    ].join("\n");

    return `${metadata}${csvContent}`;
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
      logger.info(`Generated Excel report: ${filePath}`);
      logger.info(`Workbook contains ${workbook.sheets.length} sheets`);

      // Calculate file size based on data complexity
      const baseSize = 1024 * 100; // 100KB base
      const dataMultiplier = Math.max(1, Math.floor(JSON.stringify(data).length / 1000));
      const fileSize = baseSize + dataMultiplier * 1024 * 10; // Additional 10KB per 1000 chars

      return { filePath, fileSize };
    } catch (error) {
      logger.error("Error generating Excel report", error as Error);
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
  private static generateMockExcelContent(data: any, config: ReportConfig): string {
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
            headers: ["Category", "Amount", "Transactions", "Avg per Transaction"],
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

  /**
   * CRUD Wrapper Methods for API Controller
   */
  static async create(data: any): Promise<any> {
    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const endDate = data.endDate ? new Date(data.endDate) : new Date();

    const config: ReportConfig = {
      userId: data.userId,
      type: (data.type || "spending_summary") as ReportType,
      format: (data.format || "json") as ReportFormat,
      dateRange: {
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
      },
      options: {
        includeCharts: data.includeCharts !== false,
        includeTrends: data.includeTrends,
        includeComparisons: data.includeComparisons,
        groupBy: data.groupBy,
        currency: data.currency || "INR",
      },
    };
    return await this.generateReport(config);
  }

  static async getReportById(id: string): Promise<any> {
    const { data, error } = await supabase
      .from("generated_reports")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw new Error(`Failed to fetch report: ${error.message}`);
    return data;
  }

  static async getReports(userId: string): Promise<any> {
    const { data, error } = await supabase
      .from("generated_reports")
      .select("*")
      .eq("user_id", userId)
      .limit(50)
      .order("generated_at", { ascending: false });

    if (error) throw new Error(`Failed to fetch reports: ${error.message}`);
    return data || [];
  }

  static async update(id: string, updateData: any): Promise<any> {
    // Reports are immutable, regenerate instead
    return {
      message: "Reports cannot be updated. Please generate a new report instead.",
      id,
    };
  }

  static async delete(id: string): Promise<void> {
    const { error } = await supabase.from("generated_reports").delete().eq("id", id);

    if (error) throw new Error(`Failed to delete report: ${error.message}`);
  }
}

// Export singleton instance
export const reportingService = new ReportingService();
