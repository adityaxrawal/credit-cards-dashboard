import { supabase } from "../../../../shared/database/supabase";

/**
 * Financial Health Score components
 */
interface FinancialHealthComponents {
  budgetAdherence: number; // 0-25 points
  spendingVelocity: number; // 0-20 points
  categoryDiversification: number; // 0-15 points
  cardUtilization: number; // 0-20 points
  consistencyScore: number; // 0-20 points
}

/**
 * KPI (Key Performance Indicator) interface
 */
export interface KPI {
  name: string;
  value: number;
  unit?: string;
  change?: number;
  changeType?: "increase" | "decrease" | "stable";
  trend?: "positive" | "negative" | "neutral";
  description: string;
}

/**
 * Trend data point
 */
export interface TrendPoint {
  period: string;
  value: number;
  label: string;
}

/**
 * Category analytics
 */
export interface CategoryAnalytics {
  category: string;
  totalSpent: number;
  transactionCount: number;
  averageTransaction: number;
  percentage: number;
  monthlyGrowth: number;
  topMerchants: Array<{
    merchant: string;
    amount: number;
    transactionCount: number;
  }>;
}

/**
 * Merchant analytics
 */
export interface MerchantAnalytics {
  merchant: string;
  totalSpent: number;
  transactionCount: number;
  averageTransaction: number;
  category: string;
  lastTransactionDate: string;
  frequency: "daily" | "weekly" | "monthly" | "occasional";
}

/**
 * Card comparison data
 */
export interface CardComparison {
  cardId: string;
  cardName: string;
  totalSpent: number;
  transactionCount: number;
  averageTransaction: number;
  mostUsedCategory: string;
  utilizationRate: number;
  monthlyGrowth: number;
  efficiency: number; // Based on rewards/cashback potential
}

/**
 * Advanced Analytics Service - Handles comprehensive analytics and insights
 */
export class AdvancedAnalyticsService {
  /**
   * Get comprehensive KPI dashboard
   */
  static async getKPIDashboard(
    userId: string,
    period:
      | "current_month"
      | "last_month"
      | "last_3_months"
      | "last_6_months"
      | "last_year" = "current_month"
  ): Promise<{
    kpis: KPI[];
    financialHealthScore: number;
    healthComponents: FinancialHealthComponents;
    summary: string;
  }> {
    const dateRange = this.getDateRange(period);
    const previousPeriodRange = this.getPreviousPeriodRange(period);

    // Calculate KPIs
    const kpis = await this.calculateKPIs(
      userId,
      dateRange,
      previousPeriodRange
    );

    // Calculate financial health score
    const healthComponents = await this.calculateFinancialHealth(
      userId,
      dateRange
    );
    const financialHealthScore = Object.values(healthComponents).reduce(
      (sum, score) => sum + score,
      0
    );

    // Generate summary
    const summary = this.generateKPISummary(kpis, financialHealthScore);

    return {
      kpis,
      financialHealthScore: Math.round(financialHealthScore),
      healthComponents,
      summary,
    };
  }

  /**
   * Get detailed trend analysis
   */
  static async getTrendAnalysis(
    userId: string,
    metric: "spending" | "transactions" | "categories" | "merchants",
    period: "daily" | "weekly" | "monthly" = "monthly",
    limit: number = 12
  ): Promise<{
    trends: TrendPoint[];
    analysis: {
      direction: "upward" | "downward" | "stable";
      volatility: "low" | "medium" | "high";
      seasonality: boolean;
      projection: TrendPoint[];
    };
  }> {
    const trends = await this.calculateTrends(userId, metric, period, limit);
    const analysis = this.analyzeTrends(trends);
    const projection = this.generateProjection(trends, 3); // 3 periods ahead

    return {
      trends,
      analysis: {
        ...analysis,
        projection,
      },
    };
  }

  /**
   * Get comprehensive category analytics
   */
  static async getCategoryAnalytics(
    userId: string,
    period:
      | "current_month"
      | "last_3_months"
      | "last_6_months"
      | "last_year" = "current_month"
  ): Promise<{
    categories: CategoryAnalytics[];
    insights: string[];
    recommendations: string[];
  }> {
    const dateRange = this.getDateRange(period);
    const categories = await this.calculateCategoryAnalytics(userId, dateRange);
    const insights = this.generateCategoryInsights(categories);
    const recommendations = this.generateCategoryRecommendations(categories);

    return {
      categories: categories.sort((a, b) => b.totalSpent - a.totalSpent),
      insights,
      recommendations,
    };
  }

  /**
   * Get merchant analytics
   */
  static async getMerchantAnalytics(
    userId: string,
    period:
      | "current_month"
      | "last_3_months"
      | "last_6_months"
      | "last_year" = "current_month",
    limit: number = 20
  ): Promise<{
    merchants: MerchantAnalytics[];
    insights: string[];
  }> {
    const dateRange = this.getDateRange(period);
    const merchants = await this.calculateMerchantAnalytics(
      userId,
      dateRange,
      limit
    );
    const insights = this.generateMerchantInsights(merchants);

    return {
      merchants,
      insights,
    };
  }

  /**
   * Get card comparison analysis
   */
  static async getCardComparison(
    userId: string,
    period:
      | "current_month"
      | "last_3_months"
      | "last_6_months"
      | "last_year" = "current_month"
  ): Promise<{
    cards: CardComparison[];
    recommendations: string[];
    optimization: {
      underutilizedCards: string[];
      overusedCards: string[];
      suggestions: string[];
    };
  }> {
    const dateRange = this.getDateRange(period);
    const cards = await this.calculateCardComparison(userId, dateRange);
    const recommendations = this.generateCardRecommendations(cards);
    const optimization = this.analyzeCardUsage(cards);

    return {
      cards: cards.sort((a, b) => b.totalSpent - a.totalSpent),
      recommendations,
      optimization,
    };
  }

  // Private helper methods

  private static getDateRange(period: string): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (period) {
      case "current_month":
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case "last_month":
        start.setMonth(now.getMonth() - 1, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(now.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        break;
      case "last_3_months":
        start.setMonth(now.getMonth() - 3, 1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case "last_6_months":
        start.setMonth(now.getMonth() - 6, 1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case "last_year":
        start.setFullYear(now.getFullYear() - 1, now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return { start, end };
  }

  private static getPreviousPeriodRange(period: string): {
    start: Date;
    end: Date;
  } {
    const current = this.getDateRange(period);
    const duration = current.end.getTime() - current.start.getTime();

    return {
      start: new Date(current.start.getTime() - duration),
      end: new Date(current.start.getTime() - 1),
    };
  }

  private static async calculateKPIs(
    userId: string,
    currentRange: { start: Date; end: Date },
    previousRange: { start: Date; end: Date }
  ): Promise<KPI[]> {
    // Get current period data
    const { data: currentTransactions } = await supabase
      .from("transactions")
      .select("amount, transaction_type, transaction_date")
      .eq("user_id", userId)
      .gte("transaction_date", currentRange.start.toISOString())
      .lte("transaction_date", currentRange.end.toISOString());

    // Get previous period data
    const { data: previousTransactions } = await supabase
      .from("transactions")
      .select("amount, transaction_type")
      .eq("user_id", userId)
      .gte("transaction_date", previousRange.start.toISOString())
      .lte("transaction_date", previousRange.end.toISOString());

    const currentSpending = (currentTransactions || [])
      .filter((t: any) => t.transaction_type === "debit")
      .reduce((sum, t: any) => sum + Number(t.amount), 0);

    const previousSpending = (previousTransactions || [])
      .filter((t: any) => t.transaction_type === "debit")
      .reduce((sum, t: any) => sum + Number(t.amount), 0);

    const currentTransactionCount = (currentTransactions || []).length;
    const previousTransactionCount = (previousTransactions || []).length;

    const avgTransaction =
      currentTransactionCount > 0
        ? currentSpending / currentTransactionCount
        : 0;
    const prevAvgTransaction =
      previousTransactionCount > 0
        ? previousSpending / previousTransactionCount
        : 0;

    // Calculate daily spending rate
    const daysInPeriod = Math.ceil(
      (currentRange.end.getTime() - currentRange.start.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const dailySpending = currentSpending / daysInPeriod;

    const kpis: KPI[] = [
      {
        name: "Total Spending",
        value: currentSpending,
        unit: "₹",
        change:
          previousSpending > 0
            ? ((currentSpending - previousSpending) / previousSpending) * 100
            : 0,
        changeType:
          currentSpending > previousSpending
            ? "increase"
            : currentSpending < previousSpending
              ? "decrease"
              : "stable",
        trend:
          currentSpending > previousSpending * 1.1
            ? "negative"
            : currentSpending < previousSpending * 0.9
              ? "positive"
              : "neutral",
        description: "Total amount spent across all cards",
      },
      {
        name: "Transaction Count",
        value: currentTransactionCount,
        change:
          previousTransactionCount > 0
            ? ((currentTransactionCount - previousTransactionCount) /
                previousTransactionCount) *
              100
            : 0,
        changeType:
          currentTransactionCount > previousTransactionCount
            ? "increase"
            : currentTransactionCount < previousTransactionCount
              ? "decrease"
              : "stable",
        trend: "neutral",
        description: "Total number of transactions made",
      },
      {
        name: "Average Transaction",
        value: avgTransaction,
        unit: "₹",
        change:
          prevAvgTransaction > 0
            ? ((avgTransaction - prevAvgTransaction) / prevAvgTransaction) * 100
            : 0,
        changeType:
          avgTransaction > prevAvgTransaction
            ? "increase"
            : avgTransaction < prevAvgTransaction
              ? "decrease"
              : "stable",
        trend:
          avgTransaction > prevAvgTransaction * 1.2 ? "negative" : "neutral",
        description: "Average amount per transaction",
      },
      {
        name: "Daily Spending Rate",
        value: dailySpending,
        unit: "₹/day",
        description: "Average daily spending",
      },
    ];

    return kpis;
  }

  private static async calculateFinancialHealth(
    userId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<FinancialHealthComponents> {
    // Get budget adherence score
    const budgetAdherence = await this.calculateBudgetAdherenceScore(
      userId,
      dateRange
    );

    // Get spending velocity score
    const spendingVelocity = await this.calculateSpendingVelocityScore(
      userId,
      dateRange
    );

    // Get category diversification score
    const categoryDiversification =
      await this.calculateCategoryDiversificationScore(userId, dateRange);

    // Get card utilization score
    const cardUtilization = await this.calculateCardUtilizationScore(
      userId,
      dateRange
    );

    // Get consistency score
    const consistencyScore = await this.calculateConsistencyScore(
      userId,
      dateRange
    );

    return {
      budgetAdherence,
      spendingVelocity,
      categoryDiversification,
      cardUtilization,
      consistencyScore,
    };
  }

  private static async calculateBudgetAdherenceScore(
    userId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<number> {
    const month = dateRange.start.getMonth() + 1;
    const year = dateRange.start.getFullYear();

    const { data: budgetRecord } = await supabase
      .from("budget_tracking")
      .select("budget_limit, total_spent")
      .eq("user_id", userId)
      .eq("month", month)
      .eq("year", year)
      .single();

    if (!budgetRecord || budgetRecord.budget_limit <= 0) {
      return 15; // Neutral score if no budget set
    }

    const adherence = budgetRecord.total_spent / budgetRecord.budget_limit;

    if (adherence <= 0.8) return 25; // Excellent
    if (adherence <= 0.9) return 20; // Good
    if (adherence <= 1.0) return 15; // Fair
    if (adherence <= 1.1) return 10; // Poor
    return 5; // Very poor
  }

  private static async calculateSpendingVelocityScore(
    userId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<number> {
    // Get daily spending data
    const { data: transactions } = await supabase
      .from("transactions")
      .select("amount, transaction_date")
      .eq("user_id", userId)
      .eq("transaction_type", "debit")
      .gte("transaction_date", dateRange.start.toISOString())
      .lte("transaction_date", dateRange.end.toISOString())
      .order("transaction_date");

    if (!transactions || transactions.length === 0) return 20;

    // Calculate daily totals
    const dailySpending = new Map<string, number>();
    transactions.forEach((t: any) => {
      const date = new Date(t.transaction_date).toISOString().split("T")[0];
      dailySpending.set(
        date,
        (dailySpending.get(date) || 0) + Number(t.amount)
      );
    });

    const amounts = Array.from(dailySpending.values());
    const avg = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const variance =
      amounts.reduce((sum, amt) => sum + Math.pow(amt - avg, 2), 0) /
      amounts.length;
    const coefficient = Math.sqrt(variance) / avg;

    // Lower coefficient of variation = higher score (more consistent spending)
    if (coefficient <= 0.5) return 20; // Very consistent
    if (coefficient <= 0.8) return 15; // Consistent
    if (coefficient <= 1.2) return 10; // Moderate
    if (coefficient <= 2.0) return 5; // Inconsistent
    return 2; // Very inconsistent
  }

  private static async calculateCategoryDiversificationScore(
    userId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<number> {
    const { data: transactions } = await supabase
      .from("transactions")
      .select("merchant_category, amount")
      .eq("user_id", userId)
      .eq("transaction_type", "debit")
      .gte("transaction_date", dateRange.start.toISOString())
      .lte("transaction_date", dateRange.end.toISOString());

    if (!transactions || transactions.length === 0) return 10;

    const categorySpending = new Map<string, number>();
    let totalSpending = 0;

    transactions.forEach((t: any) => {
      const category = t.merchant_category || "Other";
      const amount = Number(t.amount);
      categorySpending.set(
        category,
        (categorySpending.get(category) || 0) + amount
      );
      totalSpending += amount;
    });

    const categoryCount = categorySpending.size;

    // Calculate entropy (measure of diversity)
    let entropy = 0;
    categorySpending.forEach((amount) => {
      const proportion = amount / totalSpending;
      if (proportion > 0) {
        entropy -= proportion * Math.log2(proportion);
      }
    });

    // Normalize entropy score
    const maxEntropy = Math.log2(Math.min(categoryCount, 8)); // Cap at 8 categories
    const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

    return Math.round(normalizedEntropy * 15);
  }

  private static async calculateCardUtilizationScore(
    userId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<number> {
    // Get user's cards
    const { data: cards } = await supabase
      .from("credit_cards")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (!cards || cards.length === 0) return 15;

    // Get transactions by card
    const { data: transactions } = await supabase
      .from("transactions")
      .select("card_id, amount")
      .eq("user_id", userId)
      .eq("transaction_type", "debit")
      .gte("transaction_date", dateRange.start.toISOString())
      .lte("transaction_date", dateRange.end.toISOString());

    if (!transactions || transactions.length === 0) return 15;

    const cardUsage = new Map<string, number>();
    transactions.forEach((t: any) => {
      cardUsage.set(t.card_id, (cardUsage.get(t.card_id) || 0) + 1);
    });

    const usedCards = cardUsage.size;
    const utilizationRate = usedCards / cards.length;

    if (utilizationRate >= 0.8) return 20; // Excellent utilization
    if (utilizationRate >= 0.6) return 16; // Good utilization
    if (utilizationRate >= 0.4) return 12; // Fair utilization
    if (utilizationRate >= 0.2) return 8; // Poor utilization
    return 4; // Very poor utilization
  }

  private static async calculateConsistencyScore(
    userId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<number> {
    // Get last 3 months of data for consistency analysis
    const extendedStart = new Date(dateRange.start);
    extendedStart.setMonth(extendedStart.getMonth() - 2);

    const { data: transactions } = await supabase
      .from("transactions")
      .select("amount, transaction_date, merchant_category")
      .eq("user_id", userId)
      .eq("transaction_type", "debit")
      .gte("transaction_date", extendedStart.toISOString())
      .lte("transaction_date", dateRange.end.toISOString())
      .order("transaction_date");

    if (!transactions || transactions.length < 10) return 15;

    // Group by month and calculate monthly spending
    const monthlySpending = new Map<string, number>();
    transactions.forEach((t: any) => {
      const monthKey = new Date(t.transaction_date).toISOString().substr(0, 7); // YYYY-MM
      monthlySpending.set(
        monthKey,
        (monthlySpending.get(monthKey) || 0) + Number(t.amount)
      );
    });

    if (monthlySpending.size < 2) return 15;

    const amounts = Array.from(monthlySpending.values());
    const avg = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const variance =
      amounts.reduce((sum, amt) => sum + Math.pow(amt - avg, 2), 0) /
      amounts.length;
    const coefficient = Math.sqrt(variance) / avg;

    // Lower coefficient = higher consistency score
    if (coefficient <= 0.2) return 20; // Very consistent
    if (coefficient <= 0.4) return 16; // Consistent
    if (coefficient <= 0.6) return 12; // Moderately consistent
    if (coefficient <= 0.8) return 8; // Inconsistent
    return 4; // Very inconsistent
  }

  private static async calculateTrends(
    userId: string,
    metric: string,
    period: string,
    limit: number
  ): Promise<TrendPoint[]> {
    // Implementation would vary based on metric and period
    // This is a simplified version
    const trends: TrendPoint[] = [];

    for (let i = limit - 1; i >= 0; i--) {
      const date = new Date();
      if (period === "monthly") {
        date.setMonth(date.getMonth() - i);
      } else if (period === "weekly") {
        date.setDate(date.getDate() - i * 7);
      } else {
        date.setDate(date.getDate() - i);
      }

      // Calculate value based on metric (simplified)
      const value = Math.random() * 10000; // Placeholder

      trends.push({
        period: date.toISOString().split("T")[0],
        value,
        label: this.formatPeriodLabel(date, period),
      });
    }

    return trends;
  }

  private static analyzeTrends(trends: TrendPoint[]): {
    direction: "upward" | "downward" | "stable";
    volatility: "low" | "medium" | "high";
    seasonality: boolean;
  } {
    if (trends.length < 3) {
      return { direction: "stable", volatility: "low", seasonality: false };
    }

    // Simple trend analysis
    const firstHalf = trends.slice(0, Math.floor(trends.length / 2));
    const secondHalf = trends.slice(Math.floor(trends.length / 2));

    const firstAvg =
      firstHalf.reduce((sum, t) => sum + t.value, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, t) => sum + t.value, 0) / secondHalf.length;

    const direction =
      secondAvg > firstAvg * 1.1
        ? "upward"
        : secondAvg < firstAvg * 0.9
          ? "downward"
          : "stable";

    // Calculate volatility
    const values = trends.map((t) => t.value);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    const coefficient = Math.sqrt(variance) / avg;

    const volatility =
      coefficient > 0.5 ? "high" : coefficient > 0.2 ? "medium" : "low";

    // Simple seasonality detection (placeholder)
    const seasonality = false; // Would need more sophisticated analysis

    return { direction, volatility, seasonality };
  }

  private static generateProjection(
    trends: TrendPoint[],
    periods: number
  ): TrendPoint[] {
    if (trends.length < 2) return [];

    // Simple linear projection
    const lastTwo = trends.slice(-2);
    const slope = lastTwo[1].value - lastTwo[0].value;

    const projections: TrendPoint[] = [];
    const lastDate = new Date(trends[trends.length - 1].period);

    for (let i = 1; i <= periods; i++) {
      const futureDate = new Date(lastDate);
      futureDate.setMonth(futureDate.getMonth() + i); // Assuming monthly

      projections.push({
        period: futureDate.toISOString().split("T")[0],
        value: Math.max(0, trends[trends.length - 1].value + slope * i),
        label: this.formatPeriodLabel(futureDate, "monthly"),
      });
    }

    return projections;
  }

  private static async calculateCategoryAnalytics(
    userId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<CategoryAnalytics[]> {
    // Get current period transactions
    const { data: transactions } = await supabase
      .from("transactions")
      .select("merchant_category, merchant_name, amount")
      .eq("user_id", userId)
      .eq("transaction_type", "debit")
      .gte("transaction_date", dateRange.start.toISOString())
      .lte("transaction_date", dateRange.end.toISOString());

    if (!transactions) return [];

    // Group by category
    const categoryMap = new Map<string, any>();
    let totalSpending = 0;

    transactions.forEach((t: any) => {
      const category = t.merchant_category || "Other";
      const amount = Number(t.amount);
      totalSpending += amount;

      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          totalSpent: 0,
          transactionCount: 0,
          merchants: new Map<string, { amount: number; count: number }>(),
        });
      }

      const categoryData = categoryMap.get(category);
      categoryData.totalSpent += amount;
      categoryData.transactionCount++;

      const merchant = t.merchant_name || "Unknown";
      const merchantData = categoryData.merchants.get(merchant) || {
        amount: 0,
        count: 0,
      };
      merchantData.amount += amount;
      merchantData.count++;
      categoryData.merchants.set(merchant, merchantData);
    });

    // Convert to CategoryAnalytics array
    return Array.from(categoryMap.values()).map((data) => ({
      category: data.category,
      totalSpent: Math.round(data.totalSpent * 100) / 100,
      transactionCount: data.transactionCount,
      averageTransaction:
        Math.round((data.totalSpent / data.transactionCount) * 100) / 100,
      percentage: Math.round((data.totalSpent / totalSpending) * 10000) / 100,
      monthlyGrowth: 0, // Would need previous period comparison
      topMerchants: Array.from(data.merchants.entries())
        .map((entry: any) => {
          const [merchant, merchantData] = entry as [string, any];
          return {
            merchant,
            amount: Math.round(merchantData.amount * 100) / 100,
            transactionCount: merchantData.count,
          };
        })
        .sort((a: any, b: any) => b.amount - a.amount)
        .slice(0, 5),
    }));
  }

  private static async calculateMerchantAnalytics(
    userId: string,
    dateRange: { start: Date; end: Date },
    limit: number
  ): Promise<MerchantAnalytics[]> {
    const { data: transactions } = await supabase
      .from("transactions")
      .select("merchant_name, merchant_category, amount, transaction_date")
      .eq("user_id", userId)
      .eq("transaction_type", "debit")
      .gte("transaction_date", dateRange.start.toISOString())
      .lte("transaction_date", dateRange.end.toISOString())
      .order("transaction_date", { ascending: false });

    if (!transactions) return [];

    // Group by merchant
    const merchantMap = new Map<string, any>();

    transactions.forEach((t: any) => {
      const merchant = t.merchant_name || "Unknown";
      if (!merchantMap.has(merchant)) {
        merchantMap.set(merchant, {
          merchant,
          totalSpent: 0,
          transactionCount: 0,
          category: t.merchant_category || "Other",
          lastTransactionDate: t.transaction_date,
          dates: [],
        });
      }

      const merchantData = merchantMap.get(merchant);
      merchantData.totalSpent += Number(t.amount);
      merchantData.transactionCount++;
      merchantData.dates.push(new Date(t.transaction_date));
    });

    // Calculate frequency and convert to MerchantAnalytics
    return Array.from(merchantMap.values())
      .map((data) => ({
        merchant: data.merchant,
        totalSpent: Math.round(data.totalSpent * 100) / 100,
        transactionCount: data.transactionCount,
        averageTransaction:
          Math.round((data.totalSpent / data.transactionCount) * 100) / 100,
        category: data.category,
        lastTransactionDate: data.lastTransactionDate,
        frequency: this.calculateFrequency(data.dates, dateRange) as
          | "daily"
          | "weekly"
          | "monthly"
          | "occasional",
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);
  }

  private static async calculateCardComparison(
    userId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<CardComparison[]> {
    // Get cards and their transactions
    const { data: cards } = await supabase
      .from("credit_cards")
      .select("id, card_name, credit_limit")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (!cards) return [];

    const cardComparisons: CardComparison[] = [];

    for (const card of cards) {
      const { data: transactions } = await supabase
        .from("transactions")
        .select("amount, merchant_category")
        .eq("user_id", userId)
        .eq("card_id", card.id)
        .eq("transaction_type", "debit")
        .gte("transaction_date", dateRange.start.toISOString())
        .lte("transaction_date", dateRange.end.toISOString());

      if (!transactions || transactions.length === 0) {
        cardComparisons.push({
          cardId: card.id,
          cardName: card.card_name,
          totalSpent: 0,
          transactionCount: 0,
          averageTransaction: 0,
          mostUsedCategory: "None",
          utilizationRate: 0,
          monthlyGrowth: 0,
          efficiency: 0,
        });
        continue;
      }

      const totalSpent = transactions.reduce(
        (sum, t: any) => sum + Number(t.amount),
        0
      );
      const categoryCount = new Map<string, number>();

      transactions.forEach((t: any) => {
        const category = t.merchant_category || "Other";
        categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
      });

      const mostUsedCategory =
        Array.from(categoryCount.entries()).sort(
          ([, a], [, b]) => b - a
        )[0]?.[0] || "Other";

      const utilizationRate =
        card.credit_limit > 0 ? (totalSpent / card.credit_limit) * 100 : 0;

      cardComparisons.push({
        cardId: card.id,
        cardName: card.card_name,
        totalSpent: Math.round(totalSpent * 100) / 100,
        transactionCount: transactions.length,
        averageTransaction:
          Math.round((totalSpent / transactions.length) * 100) / 100,
        mostUsedCategory,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
        monthlyGrowth: 0, // Would need previous period comparison
        efficiency: Math.min(100, utilizationRate * 2), // Simplified efficiency calculation
      });
    }

    return cardComparisons;
  }

  private static calculateFrequency(
    dates: Date[],
    dateRange: { start: Date; end: Date }
  ): string {
    if (dates.length <= 1) return "occasional";

    dates.sort((a, b) => a.getTime() - b.getTime());
    const intervals = [];

    for (let i = 1; i < dates.length; i++) {
      const interval =
        (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
      intervals.push(interval);
    }

    const avgInterval =
      intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;

    if (avgInterval <= 3) return "daily";
    if (avgInterval <= 10) return "weekly";
    if (avgInterval <= 35) return "monthly";
    return "occasional";
  }

  private static formatPeriodLabel(date: Date, period: string): string {
    if (period === "monthly") {
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
    } else if (period === "weekly") {
      return `Week of ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  }

  private static generateKPISummary(kpis: KPI[], healthScore: number): string {
    const spendingKPI = kpis.find((k) => k.name === "Total Spending");
    const spendingTrend = spendingKPI?.change || 0;

    let summary = `Your financial health score is ${healthScore}/100. `;

    if (healthScore >= 80) {
      summary += "Excellent financial management! ";
    } else if (healthScore >= 60) {
      summary += "Good financial habits with room for improvement. ";
    } else if (healthScore >= 40) {
      summary +=
        "Moderate financial health - consider reviewing your spending patterns. ";
    } else {
      summary +=
        "Consider implementing better budgeting and spending controls. ";
    }

    if (Math.abs(spendingTrend) > 20) {
      summary += `Your spending has ${spendingTrend > 0 ? "increased" : "decreased"} by ${Math.abs(spendingTrend).toFixed(1)}% compared to the previous period.`;
    } else {
      summary += "Your spending has remained relatively stable.";
    }

    return summary;
  }

  private static generateCategoryInsights(
    categories: CategoryAnalytics[]
  ): string[] {
    const insights: string[] = [];

    if (categories.length === 0)
      return ["No spending data available for analysis."];

    const topCategory = categories[0];
    insights.push(
      `Your top spending category is ${topCategory.category} with ₹${topCategory.totalSpent.toLocaleString()} (${topCategory.percentage}% of total spending).`
    );

    const highSpendingCategories = categories.filter((c) => c.percentage > 25);
    if (highSpendingCategories.length > 1) {
      insights.push(
        `You have ${highSpendingCategories.length} categories accounting for over 25% of your spending each.`
      );
    }

    const diversificationScore = categories.length;
    if (diversificationScore >= 6) {
      insights.push(
        "Good spending diversification across multiple categories."
      );
    } else if (diversificationScore >= 4) {
      insights.push("Moderate spending diversification.");
    } else {
      insights.push(
        "Limited spending diversification - consider exploring different categories."
      );
    }

    return insights;
  }

  private static generateCategoryRecommendations(
    categories: CategoryAnalytics[]
  ): string[] {
    const recommendations: string[] = [];

    if (categories.length === 0) return [];

    const topCategory = categories[0];
    if (topCategory.percentage > 40) {
      recommendations.push(
        `Consider reducing spending in ${topCategory.category} as it represents ${topCategory.percentage}% of your total spending.`
      );
    }

    const highAvgCategories = categories.filter(
      (c) => c.averageTransaction > 2000
    );
    if (highAvgCategories.length > 0) {
      recommendations.push(
        `Review high-value transactions in: ${highAvgCategories.map((c) => c.category).join(", ")}.`
      );
    }

    recommendations.push(
      "Set category-specific budgets to better control spending in each area."
    );

    return recommendations;
  }

  private static generateMerchantInsights(
    merchants: MerchantAnalytics[]
  ): string[] {
    const insights: string[] = [];

    if (merchants.length === 0)
      return ["No merchant data available for analysis."];

    const topMerchant = merchants[0];
    insights.push(
      `Your top spending merchant is ${topMerchant.merchant} with ₹${topMerchant.totalSpent.toLocaleString()} across ${topMerchant.transactionCount} transactions.`
    );

    const frequentMerchants = merchants.filter(
      (m) => m.frequency === "daily" || m.frequency === "weekly"
    );
    if (frequentMerchants.length > 0) {
      insights.push(
        `You have ${frequentMerchants.length} frequently visited merchants, indicating regular spending patterns.`
      );
    }

    const highValueMerchants = merchants.filter(
      (m) => m.averageTransaction > 1000
    );
    if (highValueMerchants.length > 0) {
      insights.push(
        `${highValueMerchants.length} merchants have high average transaction values (>₹1,000).`
      );
    }

    return insights;
  }

  private static generateCardRecommendations(
    cards: CardComparison[]
  ): string[] {
    const recommendations: string[] = [];

    if (cards.length === 0) return [];

    const underutilizedCards = cards.filter(
      (c) => c.utilizationRate < 5 && c.transactionCount < 2
    );
    if (underutilizedCards.length > 0) {
      recommendations.push(
        `Consider using or closing underutilized cards: ${underutilizedCards.map((c) => c.cardName).join(", ")}.`
      );
    }

    const overutilizedCards = cards.filter((c) => c.utilizationRate > 30);
    if (overutilizedCards.length > 0) {
      recommendations.push(
        `Monitor high utilization on: ${overutilizedCards.map((c) => c.cardName).join(", ")}.`
      );
    }

    recommendations.push(
      "Distribute spending across cards to optimize rewards and maintain good credit utilization ratios."
    );

    return recommendations;
  }

  private static analyzeCardUsage(cards: CardComparison[]): {
    underutilizedCards: string[];
    overusedCards: string[];
    suggestions: string[];
  } {
    const underutilizedCards = cards
      .filter((c) => c.utilizationRate < 5 && c.transactionCount < 2)
      .map((c) => c.cardName);

    const overusedCards = cards
      .filter((c) => c.utilizationRate > 30)
      .map((c) => c.cardName);

    const suggestions: string[] = [];

    if (underutilizedCards.length > 0) {
      suggestions.push(
        "Use underutilized cards occasionally to keep them active."
      );
    }

    if (overusedCards.length > 0) {
      suggestions.push(
        "Reduce utilization on overused cards to improve credit score."
      );
    }

    suggestions.push(
      "Consider card-specific benefits when choosing which card to use."
    );

    return {
      underutilizedCards,
      overusedCards,
      suggestions,
    };
  }
}
