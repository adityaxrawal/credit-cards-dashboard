import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Budget status types based on spending percentage
 */
export type BudgetStatus = "safe" | "warning" | "critical" | "exceeded";

/**
 * Budget tracking interface
 */
export interface BudgetTracking {
  id: string;
  user_id: string;
  month: number;
  year: number;
  budget_limit: number;
  total_spent: number;
  alert_sent: boolean;
  alert_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Budget breakdown by category
 */
export interface CategoryBudget {
  category: string;
  spent: number;
  percentage: number;
  budget?: number;
}

/**
 * Budget breakdown by card
 */
export interface CardBudget {
  cardId: string;
  cardName: string;
  spent: number;
  percentage: number;
}

/**
 * Weekly spending breakdown
 */
export interface WeeklySpending {
  week: number;
  start: string;
  end: string;
  spent: number;
}

/**
 * Budget insights and recommendations
 */
export interface BudgetInsight {
  type: "info" | "warning" | "success";
  message: string;
  action?: string;
}

/**
 * Budget recommendations
 */
export interface BudgetRecommendation {
  priority: "high" | "medium" | "low";
  message: string;
  potentialSavings?: number;
}

/**
 * Current budget response
 */
export interface CurrentBudgetResponse {
  current: {
    month: number;
    year: number;
    budgetLimit: number;
    totalSpent: number;
    remaining: number;
    percentage: number;
    status: BudgetStatus;
    daysRemaining: number;
    dailyAverage: number;
    projectedSpend: number;
    projectedOverage: number;
    lastUpdated: string;
    nextAlertAt: string | null;
  };
  breakdown: {
    byCard: CardBudget[];
    byCategory: CategoryBudget[];
    byWeek: WeeklySpending[];
  };
  insights: BudgetInsight[];
  recommendations: BudgetRecommendation[];
}

/**
 * Budget Service - Handles all budget-related operations
 */
export class BudgetService {
  /**
   * Get current month budget status
   */
  static async getCurrentBudget(
    userId: string
  ): Promise<CurrentBudgetResponse> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Get or create budget tracking record
    let budgetRecord = await this.getBudgetRecord(userId, month, year);
    if (!budgetRecord) {
      budgetRecord = await this.createBudgetRecord(userId, month, year, 50000); // Default ₹50,000
    }

    // Calculate current spending
    const totalSpent = await this.calculateMonthlySpending(userId, month, year);

    // Update budget record if spending changed
    if (totalSpent !== budgetRecord.total_spent) {
      await this.updateBudgetSpending(budgetRecord.id, totalSpent);
      budgetRecord.total_spent = totalSpent;
    }

    // Calculate derived values
    const remaining = budgetRecord.budget_limit - totalSpent;
    const percentage = (totalSpent / budgetRecord.budget_limit) * 100;
    const status = this.calculateBudgetStatus(percentage);

    // Date calculations
    const daysInMonth = new Date(year, month, 0).getDate();
    const currentDay = now.getDate();
    const daysRemaining = daysInMonth - currentDay + 1;
    const dailyAverage = totalSpent / currentDay;
    const projectedSpend = dailyAverage * daysInMonth;
    const projectedOverage = Math.max(
      0,
      projectedSpend - budgetRecord.budget_limit
    );

    // Get breakdowns
    const [byCard, byCategory, byWeek] = await Promise.all([
      this.getCardBreakdown(userId, month, year, totalSpent),
      this.getCategoryBreakdown(userId, month, year, totalSpent),
      this.getWeeklyBreakdown(userId, month, year),
    ]);

    // Generate insights and recommendations
    const insights = this.generateInsights(
      percentage,
      status,
      projectedSpend,
      budgetRecord.budget_limit,
      daysRemaining
    );
    const recommendations = this.generateRecommendations(
      status,
      projectedOverage,
      byCategory,
      dailyAverage,
      daysRemaining
    );

    return {
      current: {
        month,
        year,
        budgetLimit: budgetRecord.budget_limit,
        totalSpent,
        remaining,
        percentage: Math.round(percentage * 100) / 100,
        status,
        daysRemaining,
        dailyAverage: Math.round(dailyAverage * 100) / 100,
        projectedSpend: Math.round(projectedSpend * 100) / 100,
        projectedOverage: Math.round(projectedOverage * 100) / 100,
        lastUpdated: new Date().toISOString(),
        nextAlertAt: this.calculateNextAlertTime(status),
      },
      breakdown: {
        byCard,
        byCategory,
        byWeek,
      },
      insights,
      recommendations,
    };
  }

  /**
   * Update budget limit
   */
  static async updateBudgetLimit(
    userId: string,
    budgetLimit: number,
    effectiveFrom: "current_month" | "next_month" = "next_month"
  ): Promise<{ success: boolean; budget: BudgetTracking; impact: any }> {
    const now = new Date();
    let month: number, year: number;

    if (effectiveFrom === "current_month") {
      month = now.getMonth() + 1;
      year = now.getFullYear();
    } else {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1);
      month = nextMonth.getMonth() + 1;
      year = nextMonth.getFullYear();
    }

    // Get existing budget record
    const existingRecord = await this.getBudgetRecord(userId, month, year);
    const previousLimit = existingRecord?.budget_limit || 0;

    let budgetRecord: BudgetTracking;

    if (existingRecord) {
      // Update existing record
      const { data, error } = await supabase
        .from("budget_tracking")
        .update({
          budget_limit: budgetLimit,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingRecord.id)
        .select()
        .single();

      if (error) throw error;
      budgetRecord = data;
    } else {
      // Create new record
      budgetRecord = await this.createBudgetRecord(
        userId,
        month,
        year,
        budgetLimit
      );
    }

    // Calculate impact
    const currentSpending = await this.calculateMonthlySpending(
      userId,
      month,
      year
    );
    const change = budgetLimit - previousLimit;
    const changePercentage =
      previousLimit > 0 ? (change / previousLimit) * 100 : 0;
    const newStatus = this.calculateBudgetStatus(
      (currentSpending / budgetLimit) * 100
    );

    const impact = {
      previousLimit,
      newLimit: budgetLimit,
      change,
      changePercentage: Math.round(changePercentage * 100) / 100,
      currentSpending,
      newStatus,
    };

    return {
      success: true,
      budget: budgetRecord,
      impact,
    };
  }

  /**
   * Get budget history
   */
  static async getBudgetHistory(
    userId: string,
    months: number = 12
  ): Promise<BudgetTracking[]> {
    const { data, error } = await supabase
      .from("budget_tracking")
      .select("*")
      .eq("user_id", userId)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(months);

    if (error) throw error;
    return data || [];
  }

  /**
   * Forecast future spending
   */
  static async forecastSpending(
    userId: string,
    months: number = 3
  ): Promise<
    {
      month: number;
      year: number;
      projectedSpend: number;
      confidence: number;
    }[]
  > {
    // Get historical spending data
    const history = await this.getBudgetHistory(userId, 12);
    if (history.length < 3) {
      throw new Error("Insufficient historical data for forecasting");
    }

    const forecasts = [];
    const now = new Date();

    // Simple moving average with trend analysis
    const recentSpending = history.slice(0, 6).map((h) => h.total_spent);
    const averageSpending =
      recentSpending.reduce((a, b) => a + b, 0) / recentSpending.length;

    // Calculate trend
    const trend = this.calculateTrend(recentSpending);

    for (let i = 1; i <= months; i++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i);
      const month = futureDate.getMonth() + 1;
      const year = futureDate.getFullYear();

      // Apply trend to average
      const projectedSpend = averageSpending * (1 + trend * i);
      const confidence = Math.max(0.3, 1 - i * 0.15); // Decreasing confidence

      forecasts.push({
        month,
        year,
        projectedSpend: Math.round(projectedSpend * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
      });
    }

    return forecasts;
  }

  /**
   * Simulate budget scenarios
   */
  static async simulateBudget(
    userId: string,
    scenarios: {
      budgetLimit: number;
      categoryLimits?: { [category: string]: number };
    }[]
  ): Promise<any[]> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const currentSpending = await this.calculateMonthlySpending(
      userId,
      month,
      year
    );
    const categoryBreakdown = await this.getCategoryBreakdown(
      userId,
      month,
      year,
      currentSpending
    );

    return scenarios.map((scenario, index) => {
      const budgetUtilization = (currentSpending / scenario.budgetLimit) * 100;
      const status = this.calculateBudgetStatus(budgetUtilization);
      const remaining = scenario.budgetLimit - currentSpending;

      let categoryAnalysis = {};
      if (scenario.categoryLimits) {
        categoryAnalysis = categoryBreakdown.reduce((acc, cat) => {
          const limit = scenario.categoryLimits![cat.category];
          if (limit) {
            acc[cat.category] = {
              spent: cat.spent,
              limit,
              remaining: limit - cat.spent,
              utilization: (cat.spent / limit) * 100,
              status: this.calculateBudgetStatus((cat.spent / limit) * 100),
            };
          }
          return acc;
        }, {} as any);
      }

      return {
        scenarioId: index + 1,
        budgetLimit: scenario.budgetLimit,
        currentSpending,
        remaining,
        utilization: Math.round(budgetUtilization * 100) / 100,
        status,
        categoryLimits: scenario.categoryLimits || null,
        categoryAnalysis,
        recommendation: this.getScenarioRecommendation(
          status,
          remaining,
          budgetUtilization
        ),
      };
    });
  }

  // Private helper methods

  private static async getBudgetRecord(
    userId: string,
    month: number,
    year: number
  ): Promise<BudgetTracking | null> {
    const { data, error } = await supabase
      .from("budget_tracking")
      .select("*")
      .eq("user_id", userId)
      .eq("month", month)
      .eq("year", year)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
    return data;
  }

  private static async createBudgetRecord(
    userId: string,
    month: number,
    year: number,
    budgetLimit: number
  ): Promise<BudgetTracking> {
    const { data, error } = await supabase
      .from("budget_tracking")
      .insert({
        user_id: userId,
        month,
        year,
        budget_limit: budgetLimit,
        total_spent: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  private static async updateBudgetSpending(
    id: string,
    totalSpent: number
  ): Promise<void> {
    const { error } = await supabase
      .from("budget_tracking")
      .update({
        total_spent: totalSpent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
  }

  private static async calculateMonthlySpending(
    userId: string,
    month: number,
    year: number
  ): Promise<number> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const { data, error } = await supabase
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("transaction_type", "debit")
      .gte("transaction_date", startDate.toISOString())
      .lte("transaction_date", endDate.toISOString());

    if (error) throw error;

    return (data || []).reduce(
      (sum: number, transaction: any) => sum + Number(transaction.amount),
      0
    );
  }

  private static async getCardBreakdown(
    userId: string,
    month: number,
    year: number,
    totalSpent: number
  ): Promise<CardBudget[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const { data, error } = await supabase
      .from("transactions")
      .select(
        `
        amount,
        credit_cards!inner(id, card_name)
      `
      )
      .eq("user_id", userId)
      .eq("transaction_type", "debit")
      .gte("transaction_date", startDate.toISOString())
      .lte("transaction_date", endDate.toISOString());

    if (error) throw error;

    const cardTotals = (data || []).reduce((acc: any, transaction: any) => {
      const card = transaction.credit_cards;
      if (!acc[card.id]) {
        acc[card.id] = {
          cardId: card.id,
          cardName: card.card_name,
          spent: 0,
        };
      }
      acc[card.id].spent += Number(transaction.amount);
      return acc;
    }, {} as any);

    return Object.values(cardTotals).map((card: any) => ({
      ...card,
      spent: Math.round(card.spent * 100) / 100,
      percentage:
        totalSpent > 0
          ? Math.round((card.spent / totalSpent) * 10000) / 100
          : 0,
    }));
  }

  private static async getCategoryBreakdown(
    userId: string,
    month: number,
    year: number,
    totalSpent: number
  ): Promise<CategoryBudget[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const { data, error } = await supabase
      .from("transactions")
      .select("amount, merchant_category")
      .eq("user_id", userId)
      .eq("transaction_type", "debit")
      .gte("transaction_date", startDate.toISOString())
      .lte("transaction_date", endDate.toISOString());

    if (error) throw error;

    const categoryTotals = (data || []).reduce((acc: any, transaction: any) => {
      const category = transaction.merchant_category || "Other";
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category] += Number(transaction.amount);
      return acc;
    }, {} as any);

    return Object.entries(categoryTotals).map(
      ([category, spent]: [string, any]) => ({
        category,
        spent: Math.round(spent * 100) / 100,
        percentage:
          totalSpent > 0 ? Math.round((spent / totalSpent) * 10000) / 100 : 0,
      })
    );
  }

  private static async getWeeklyBreakdown(
    userId: string,
    month: number,
    year: number
  ): Promise<WeeklySpending[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const weeks: WeeklySpending[] = [];

    let currentWeekStart = new Date(startDate);
    let weekNumber = 1;

    while (currentWeekStart <= endDate) {
      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
      if (currentWeekEnd > endDate) {
        currentWeekEnd.setTime(endDate.getTime());
      }

      const { data, error } = await supabase
        .from("transactions")
        .select("amount")
        .eq("user_id", userId)
        .eq("transaction_type", "debit")
        .gte("transaction_date", currentWeekStart.toISOString())
        .lte("transaction_date", currentWeekEnd.toISOString());

      if (error) throw error;

      const weekSpent = (data || []).reduce(
        (sum: number, t: any) => sum + Number(t.amount),
        0
      );

      weeks.push({
        week: weekNumber,
        start: currentWeekStart.toISOString().split("T")[0],
        end: currentWeekEnd.toISOString().split("T")[0],
        spent: Math.round(weekSpent * 100) / 100,
      });

      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      weekNumber++;
    }

    return weeks;
  }

  private static calculateBudgetStatus(percentage: number): BudgetStatus {
    if (percentage < 70) return "safe";
    if (percentage < 90) return "warning";
    if (percentage < 100) return "critical";
    return "exceeded";
  }

  private static generateInsights(
    percentage: number,
    status: BudgetStatus,
    projectedSpend: number,
    budgetLimit: number,
    daysRemaining: number
  ): BudgetInsight[] {
    const insights: BudgetInsight[] = [];

    if (status === "exceeded") {
      insights.push({
        type: "warning",
        message: `You have exceeded your budget by ₹${
          Math.round((projectedSpend - budgetLimit) * 100) / 100
        }`,
        action: "Consider reducing spending or increasing your budget limit",
      });
    } else if (status === "critical") {
      insights.push({
        type: "warning",
        message: `You are at ${Math.round(percentage)}% of your budget with ${daysRemaining} days remaining`,
        action: `Limit spending to ₹${
          Math.round(
            ((budgetLimit - (budgetLimit * percentage) / 100) / daysRemaining) *
              100
          ) / 100
        } per day`,
      });
    } else if (status === "safe") {
      const remaining = budgetLimit - (budgetLimit * percentage) / 100;
      insights.push({
        type: "success",
        message: `Great! You are ₹${Math.round(remaining * 100) / 100} under budget with ${daysRemaining} days remaining`,
      });
    }

    // Velocity insight
    if (projectedSpend > budgetLimit * 1.1) {
      const velocityIncrease = (projectedSpend / budgetLimit - 1) * 100;
      insights.push({
        type: "warning",
        message: `You are spending ${Math.round(velocityIncrease)}% faster than optimal pace`,
        action: `Reduce daily spending to stay within budget`,
      });
    }

    return insights;
  }

  private static generateRecommendations(
    status: BudgetStatus,
    projectedOverage: number,
    categoryBreakdown: CategoryBudget[],
    dailyAverage: number,
    daysRemaining: number
  ): BudgetRecommendation[] {
    const recommendations: BudgetRecommendation[] = [];

    if (status === "exceeded" || status === "critical") {
      // Find highest spending categories
      const topCategories = categoryBreakdown
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 2);

      if (topCategories.length > 0) {
        recommendations.push({
          priority: "high",
          message: `Consider reducing spending in ${topCategories[0].category} (₹${topCategories[0].spent} this month)`,
          potentialSavings:
            Math.round(topCategories[0].spent * 0.2 * 100) / 100,
        });
      }

      if (projectedOverage > 0) {
        const dailyReduction = projectedOverage / daysRemaining;
        recommendations.push({
          priority: "high",
          message: `Reduce daily spending by ₹${Math.round(dailyReduction * 100) / 100} to stay within budget`,
          potentialSavings: projectedOverage,
        });
      }
    }

    // General optimization recommendations
    if (dailyAverage > 0) {
      recommendations.push({
        priority: "medium",
        message: "Set up spending alerts for real-time budget monitoring",
      });
    }

    return recommendations;
  }

  private static calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    // Simple linear regression slope
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const averageY = sumY / n;

    return slope / averageY; // Normalized trend
  }

  private static calculateNextAlertTime(status: BudgetStatus): string | null {
    const now = new Date();

    switch (status) {
      case "safe":
        // Next check in 24 hours
        return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      case "warning":
        // Check every 12 hours
        return new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
      case "critical":
        // Check every 6 hours
        return new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
      case "exceeded":
        // Check daily
        return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      default:
        return null;
    }
  }

  private static getScenarioRecommendation(
    status: BudgetStatus,
    remaining: number,
    utilization: number
  ): string {
    if (status === "exceeded") {
      return "Budget too low for current spending patterns";
    } else if (status === "critical") {
      return "Budget is tight - monitor spending closely";
    } else if (utilization < 50) {
      return "Conservative budget with good spending room";
    } else {
      return "Balanced budget for current spending level";
    }
  }
}
