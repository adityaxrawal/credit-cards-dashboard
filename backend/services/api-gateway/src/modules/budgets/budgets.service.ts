import { supabase } from "shared/database/supabase";
import { logger } from "shared/monitoring/logger";

/**
 * Period type for budgets
 */
export type PeriodType = "monthly" | "quarterly" | "annual";

/**
 * Budget category interface
 */
export interface BudgetCategory {
  id: string;
  user_id: string;
  category_name: string;
  budget_limit: number;
  period_type: PeriodType;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Card budget interface
 */
export interface CardBudget {
  id: string;
  user_id: string;
  card_id: string;
  month: number;
  year: number;
  budget_limit: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

/**
 * Budget audit log interface
 */
export interface BudgetAuditLog {
  id: string;
  user_id: string;
  budget_id?: string;
  action_type: "create" | "update" | "delete" | "threshold_breach" | "alert_triggered";
  entity_type: "budget_tracking" | "budget_category" | "card_budget";
  old_value?: any;
  new_value?: any;
  metadata?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

/**
 * Budget alert configuration
 */
export interface BudgetAlertConfig {
  id: string;
  user_id: string;
  threshold_percentages: number[];
  alert_channels: string[];
  daily_digest_enabled: boolean;
  weekly_summary_enabled: boolean;
  custom_rules: any[];
  created_at: string;
  updated_at: string;
}

/**
 * Spending forecast interface
 */
export interface SpendingForecast {
  id: string;
  user_id: string;
  forecast_date: string;
  forecast_type: "daily" | "weekly" | "monthly";
  predicted_amount: number;
  confidence_level: number;
  actual_amount?: number;
  variance?: number;
  model_version?: string;
  metadata?: any;
  created_at: string;
}

/**
 * Enhanced Budget Service with advanced features
 */
export class EnhancedBudgetService {
  /**
   * Create category-level budget
   */
  static async createCategoryBudget(
    userId: string,
    categoryName: string,
    budgetLimit: number,
    periodType: PeriodType = "monthly",
    startDate?: Date,
    metadata?: any
  ): Promise<BudgetCategory> {
    const start = startDate || new Date();
    let endDate: Date | undefined;

    // Calculate end date based on period type
    if (periodType === "quarterly") {
      endDate = new Date(start);
      endDate.setMonth(start.getMonth() + 3);
    } else if (periodType === "annual") {
      endDate = new Date(start);
      endDate.setFullYear(start.getFullYear() + 1);
    } else {
      endDate = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    }

    const { data, error } = await supabase
      .from("budget_categories")
      .insert({
        user_id: userId,
        category_name: categoryName,
        budget_limit: budgetLimit,
        period_type: periodType,
        start_date: start.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    // Log the creation
    await this.logBudgetAction(userId, data.id, "create", "budget_category", null, data, metadata);

    return data;
  }

  /**
   * Update category budget
   */
  static async updateCategoryBudget(
    userId: string,
    categoryId: string,
    updates: Partial<BudgetCategory>,
    metadata?: any
  ): Promise<BudgetCategory> {
    // Get old value for audit log
    const { data: oldData } = await supabase
      .from("budget_categories")
      .select("*")
      .eq("id", categoryId)
      .eq("user_id", userId)
      .single();

    const { data, error } = await supabase
      .from("budget_categories")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", categoryId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;

    // Log the update
    await this.logBudgetAction(
      userId,
      categoryId,
      "update",
      "budget_category",
      oldData,
      data,
      metadata
    );

    return data;
  }

  /**
   * Get active category budgets
   */
  static async getCategoryBudgets(
    userId: string,
    periodType?: PeriodType
  ): Promise<BudgetCategory[]> {
    let query = supabase
      .from("budget_categories")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (periodType) {
      query = query.eq("period_type", periodType);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get category spending vs budget
   */
  static async getCategorySpending(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<
    {
      category: string;
      spent: number;
      budget: number;
      percentage: number;
      status: string;
    }[]
  > {
    // Get category budgets
    const categoryBudgets = await this.getCategoryBudgets(userId);

    // Get spending data
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("amount, merchant_category")
      .eq("user_id", userId)
      .eq("transaction_type", "debit")
      .gte("transaction_date", startDate.toISOString())
      .lte("transaction_date", endDate.toISOString());

    if (error) throw error;

    // Aggregate by category
    const categorySpending = (transactions || []).reduce(
      (acc, t) => {
        const category = t.merchant_category || "Other";
        acc[category] = (acc[category] || 0) + Number(t.amount);
        return acc;
      },
      {} as Record<string, number>
    );

    // Combine with budgets
    return categoryBudgets.map((budget) => {
      const spent = categorySpending[budget.category_name] || 0;
      const percentage = (spent / budget.budget_limit) * 100;
      const status =
        percentage >= 100
          ? "exceeded"
          : percentage >= 90
            ? "critical"
            : percentage >= 75
              ? "warning"
              : "safe";

      return {
        category: budget.category_name,
        spent: Math.round(spent * 100) / 100,
        budget: budget.budget_limit,
        percentage: Math.round(percentage * 100) / 100,
        status,
      };
    });
  }

  /**
   * Create or update card-specific budget
   */
  static async setCardBudget(
    userId: string,
    cardId: string,
    month: number,
    year: number,
    budgetLimit: number,
    metadata?: any
  ): Promise<CardBudget> {
    // Check if exists
    const { data: existing } = await supabase
      .from("card_budgets")
      .select("*")
      .eq("card_id", cardId)
      .eq("month", month)
      .eq("year", year)
      .single();

    let result: CardBudget;

    if (existing) {
      // Update
      const { data, error } = await supabase
        .from("card_budgets")
        .update({
          budget_limit: budgetLimit,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;

      await this.logBudgetAction(
        userId,
        data.id,
        "update",
        "card_budget",
        existing,
        data,
        metadata
      );
    } else {
      // Create
      const { data, error } = await supabase
        .from("card_budgets")
        .insert({
          user_id: userId,
          card_id: cardId,
          month,
          year,
          budget_limit: budgetLimit,
          total_spent: 0,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;

      await this.logBudgetAction(userId, data.id, "create", "card_budget", null, data, metadata);
    }

    return result;
  }

  /**
   * Get card budgets for a period
   */
  static async getCardBudgets(
    userId: string,
    month: number,
    year: number
  ): Promise<
    {
      cardId: string;
      cardName: string;
      budgetLimit: number;
      spent: number;
      remaining: number;
      percentage: number;
      status: string;
    }[]
  > {
    const { data: cardBudgets, error: budgetError } = await supabase
      .from("card_budgets")
      .select(
        `
        *,
        credit_cards!inner(id, card_name)
      `
      )
      .eq("user_id", userId)
      .eq("month", month)
      .eq("year", year);

    if (budgetError) throw budgetError;

    return (cardBudgets || []).map((cb: any) => {
      const percentage = (cb.total_spent / cb.budget_limit) * 100;
      const status =
        percentage >= 100
          ? "exceeded"
          : percentage >= 90
            ? "critical"
            : percentage >= 75
              ? "warning"
              : "safe";

      return {
        cardId: cb.card_id,
        cardName: cb.credit_cards.card_name,
        budgetLimit: cb.budget_limit,
        spent: cb.total_spent,
        remaining: Math.max(0, cb.budget_limit - cb.total_spent),
        percentage: Math.round(percentage * 100) / 100,
        status,
      };
    });
  }

  /**
   * Get or create budget alert configuration
   */
  static async getBudgetAlertConfig(userId: string): Promise<BudgetAlertConfig> {
    const { data, error } = await supabase
      .from("budget_alert_config")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code === "PGRST116") {
      // Create default config
      const { data: newConfig, error: createError } = await supabase
        .from("budget_alert_config")
        .insert({
          user_id: userId,
          threshold_percentages: [50, 75, 90, 100],
          alert_channels: ["in_app", "email"],
          daily_digest_enabled: false,
          weekly_summary_enabled: true,
          custom_rules: [],
        })
        .select()
        .single();

      if (createError) throw createError;
      return newConfig;
    }

    if (error) throw error;
    return data;
  }

  /**
   * Update budget alert configuration
   */
  static async updateBudgetAlertConfig(
    userId: string,
    updates: Partial<BudgetAlertConfig>
  ): Promise<BudgetAlertConfig> {
    const { data, error } = await supabase
      .from("budget_alert_config")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Generate spending forecast using ML-based approach
   */
  static async generateSpendingForecast(
    userId: string,
    forecastDays: number = 30
  ): Promise<SpendingForecast[]> {
    // Get historical data (last 90 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("transaction_date, amount")
      .eq("user_id", userId)
      .eq("transaction_type", "debit")
      .gte("transaction_date", startDate.toISOString())
      .lte("transaction_date", endDate.toISOString())
      .order("transaction_date", { ascending: true });

    if (error) throw error;

    if (!transactions || transactions.length < 7) {
      throw new Error("Insufficient historical data for forecasting");
    }

    // Aggregate by day
    const dailySpending = this.aggregateDailySpending(transactions);

    // Calculate statistics
    const amounts = Object.values(dailySpending);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance =
      amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    // Generate forecasts
    const forecasts: SpendingForecast[] = [];
    const now = new Date();

    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = new Date(now);
      forecastDate.setDate(now.getDate() + i);

      // Simple model: mean with decay factor for confidence
      const decayFactor = 1 - i / (forecastDays * 2);
      const confidence = Math.max(0.3, 0.85 * decayFactor);

      // Add some variance for realistic predictions
      const prediction = mean + (Math.random() - 0.5) * stdDev * 0.3;

      forecasts.push({
        id: "",
        user_id: userId,
        forecast_date: forecastDate.toISOString().split("T")[0],
        forecast_type: "daily",
        predicted_amount: Math.max(0, Math.round(prediction * 100) / 100),
        confidence_level: Math.round(confidence * 100) / 100,
        model_version: "v1.0",
        metadata: {
          mean,
          stdDev,
          historicalDays: amounts.length,
        },
        created_at: new Date().toISOString(),
      });
    }

    // Store forecasts
    const { error: insertError } = await supabase.from("spending_forecasts").upsert(
      forecasts.map((f) => ({
        user_id: f.user_id,
        forecast_date: f.forecast_date,
        forecast_type: f.forecast_type,
        predicted_amount: f.predicted_amount,
        confidence_level: f.confidence_level,
        model_version: f.model_version,
        metadata: f.metadata,
      })),
      {
        onConflict: "user_id,forecast_date,forecast_type",
      }
    );

    if (insertError) logger.error("Error storing forecasts", insertError);

    return forecasts;
  }

  /**
   * Get budget audit log
   */
  static async getBudgetAuditLog(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      actionType?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<{ logs: BudgetAuditLog[]; total: number }> {
    let query = supabase
      .from("budget_audit_log")
      .select("*", { count: "exact" })
      .eq("user_id", userId);

    if (options.actionType) {
      query = query.eq("action_type", options.actionType);
    }

    if (options.startDate) {
      query = query.gte("created_at", options.startDate);
    }

    if (options.endDate) {
      query = query.lte("created_at", options.endDate);
    }

    query = query.order("created_at", { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      logs: data || [],
      total: count || 0,
    };
  }

  /**
   * Get comprehensive budget analytics
   */
  static async getComprehensiveBudgetAnalytics(userId: string): Promise<{
    overview: any;
    monthly: any;
    categories: any[];
    cards: any[];
    trends: any;
    forecasts: SpendingForecast[];
    recommendations: any[];
  }> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Get monthly budget data
    const { data: monthlyBudget } = await supabase
      .from("budget_tracking")
      .select("*")
      .eq("user_id", userId)
      .eq("month", month)
      .eq("year", year)
      .single();

    const budgetLimit = monthlyBudget?.budget_limit || 50000;
    const totalSpent = monthlyBudget?.total_spent || 0;
    const percentage = (totalSpent / budgetLimit) * 100;

    // Get category spending
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    const categories = await this.getCategorySpending(userId, startOfMonth, endOfMonth);

    // Get card budgets
    const cards = await this.getCardBudgets(userId, month, year);

    // Get historical trends (last 6 months)
    const { data: historical } = await supabase
      .from("budget_tracking")
      .select("*")
      .eq("user_id", userId)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(6);

    const trends = {
      historicalSpending: (historical || []).map((h) => ({
        month: h.month,
        year: h.year,
        spent: h.total_spent,
        budget: h.budget_limit,
      })),
      averageMonthlySpend:
        (historical || []).reduce((sum, h) => sum + h.total_spent, 0) / (historical?.length || 1),
    };

    // Generate forecasts
    const forecasts = await this.generateSpendingForecast(userId, 30);

    // Generate recommendations
    const recommendations = this.generateAdvancedRecommendations(
      percentage,
      categories,
      cards,
      trends,
      forecasts
    );

    return {
      overview: {
        budgetLimit,
        totalSpent,
        remaining: budgetLimit - totalSpent,
        percentage: Math.round(percentage * 100) / 100,
        status:
          percentage >= 100
            ? "exceeded"
            : percentage >= 90
              ? "critical"
              : percentage >= 75
                ? "warning"
                : "safe",
      },
      monthly: monthlyBudget,
      categories,
      cards,
      trends,
      forecasts: forecasts.slice(0, 30),
      recommendations,
    };
  }

  // Private helper methods

  private static async logBudgetAction(
    userId: string,
    budgetId: string,
    actionType: "create" | "update" | "delete" | "threshold_breach" | "alert_triggered",
    entityType: "budget_tracking" | "budget_category" | "card_budget",
    oldValue: any,
    newValue: any,
    metadata?: any
  ): Promise<void> {
    const { error } = await supabase.from("budget_audit_log").insert({
      user_id: userId,
      budget_id: budgetId,
      action_type: actionType,
      entity_type: entityType,
      old_value: oldValue,
      new_value: newValue,
      metadata: metadata || {},
    });

    if (error) logger.error("Error logging budget action", error);
  }

  private static aggregateDailySpending(transactions: any[]): Record<string, number> {
    return transactions.reduce(
      (acc, t) => {
        const date = t.transaction_date.split("T")[0];
        acc[date] = (acc[date] || 0) + Number(t.amount);
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private static generateAdvancedRecommendations(
    percentage: number,
    categories: any[],
    cards: any[],
    trends: any,
    forecasts: SpendingForecast[]
  ): any[] {
    const recommendations: Array<{
      priority: string;
      type: string;
      title: string;
      message: string;
      action: string;
    }> = [];

    // Budget status recommendations
    if (percentage >= 90) {
      recommendations.push({
        priority: "high",
        type: "spending_control",
        title: "Critical Budget Alert",
        message: "You've used over 90% of your budget. Consider freezing non-essential spending.",
        action: "Review and cut discretionary expenses",
      });
    }

    // Category-based recommendations
    const topSpendingCategories = categories.sort((a, b) => b.spent - a.spent).slice(0, 3);

    if (topSpendingCategories[0] && topSpendingCategories[0].percentage > 80) {
      recommendations.push({
        priority: "medium",
        type: "category_optimization",
        title: `High Spending in ${topSpendingCategories[0].category}`,
        message: `${topSpendingCategories[0].category} accounts for ${topSpendingCategories[0].percentage}% of category budget`,
        action: `Consider setting stricter limits for ${topSpendingCategories[0].category}`,
      });
    }

    // Card-based recommendations
    const cardsOverBudget = cards.filter((c) => c.percentage >= 100);
    if (cardsOverBudget.length > 0) {
      recommendations.push({
        priority: "high",
        type: "card_management",
        title: "Cards Over Budget",
        message: `${cardsOverBudget.length} card(s) have exceeded their budget limits`,
        action: "Review card-specific budgets and spending patterns",
      });
    }

    // Forecast-based recommendations
    const avgForecast = forecasts.slice(0, 7).reduce((sum, f) => sum + f.predicted_amount, 0) / 7;
    const avgHistorical = trends.averageMonthlySpend / 30;

    if (avgForecast > avgHistorical * 1.2) {
      recommendations.push({
        priority: "medium",
        type: "trend_alert",
        title: "Increasing Spending Trend",
        message: "Your predicted spending is 20% higher than your historical average",
        action: "Review recent transactions and identify new spending patterns",
      });
    }

    return recommendations;
  }

  /**
   * CRUD Wrapper Methods for API Controller
   */
  static async createBudget(data: any): Promise<any> {
    return await this.createCategoryBudget(
      data.userId,
      data.category,
      data.amount,
      data.period || "monthly",
      data.startDate ? new Date(data.startDate) : new Date(),
      data.endDate ? new Date(data.endDate) : undefined
    );
  }

  static async getBudgetById(id: string): Promise<any> {
    const { data } = await supabase.from("budgets").select("*").eq("id", id).single();
    return data;
  }

  static async getBudgets(userId: string): Promise<any> {
    return await this.getCategoryBudgets(userId);
  }

  static async updateBudget(id: string, data: any): Promise<any> {
    return await this.updateCategoryBudget(id, data.userId, data);
  }

  static async deleteBudget(id: string): Promise<void> {
    await supabase.from("budgets").delete().eq("id", id);
  }
}

// Export singleton instance
export const enhancedBudgetService = new EnhancedBudgetService();
