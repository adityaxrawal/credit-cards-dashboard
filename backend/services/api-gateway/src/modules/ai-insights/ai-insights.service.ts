import { supabase } from "shared/database/supabase";

/**
 * AI-powered financial insights and recommendations
 */
export interface FinancialInsight {
  id: string;
  type:
    | "spending_pattern"
    | "optimization"
    | "prediction"
    | "warning"
    | "opportunity";
  title: string;
  description: string;
  confidence: number; // 0-100
  impact: "low" | "medium" | "high";
  category?: string;
  cardId?: string;
  actionable: boolean;
  action?: {
    title: string;
    description: string;
    url?: string;
  };
  metadata: {
    dataPoints: number;
    timeframe: string;
    calculatedAt: string;
  };
}

/**
 * Spending pattern analysis
 */
export interface SpendingPattern {
  pattern: "increasing" | "decreasing" | "stable" | "seasonal" | "irregular";
  category: string;
  confidence: number;
  trend: {
    direction: "up" | "down" | "flat";
    percentage: number;
    period: string;
  };
  seasonality?: {
    detected: boolean;
    peak_months: number[];
    low_months: number[];
  };
}

/**
 * Card optimization recommendation
 */
export interface CardOptimization {
  currentCard: {
    id: string;
    name: string;
    category: string;
    rewardRate: number;
    potentialReward: number;
  };
  recommendedCard: {
    id: string;
    name: string;
    category: string;
    rewardRate: number;
    potentialReward: number;
  };
  improvement: {
    additionalReward: number;
    percentageGain: number;
  };
  confidence: number;
}

/**
 * Predictive spending forecast
 */
export interface SpendingForecast {
  period: "next_month" | "next_quarter" | "next_year";
  totalPredicted: number;
  categoryBreakdown: {
    category: string;
    predicted: number;
    confidence: number;
    trend: "up" | "down" | "stable";
  }[];
  budgetImpact: {
    likelyOverspend: number;
    riskCategories: string[];
    recommendations: string[];
  };
}

/**
 * Transaction anomaly detection result
 */
export interface TransactionAnomaly {
  id: string;
  transactionId: string;
  type:
    | "unusual_amount"
    | "unusual_time"
    | "unusual_merchant"
    | "rapid_succession"
    | "duplicate"
    | "location_mismatch";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  riskScore: number; // 0-100
  details: {
    [key: string]: any;
  };
  detectedAt: string;
}

/**
 * AI Insights Service - Advanced financial intelligence
 */
export class AIInsightsService {
  /**
   * Generate comprehensive financial insights for a user
   */
  static async generateInsights(userId: string): Promise<FinancialInsight[]> {
    try {
      const insights: FinancialInsight[] = [];

      // Get user's transaction data for analysis
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .gte(
          "transaction_date",
          new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
        )
        .order("transaction_date", { ascending: false });

      if (error || !transactions?.length) {
        return [];
      }

      // Generate different types of insights
      const spendingPatterns = await this.analyzeSpendingPatterns(transactions);
      const cardOptimizations = await this.analyzeCardOptimization(
        userId,
        transactions
      );
      const budgetInsights = await this.analyzeBudgetTrends(
        userId,
        transactions
      );
      const predictionInsights =
        await this.generatePredictiveInsights(transactions);

      // Convert analyses to insights
      insights.push(...this.convertPatternsToInsights(spendingPatterns));
      insights.push(...this.convertOptimizationsToInsights(cardOptimizations));
      insights.push(...this.convertBudgetToInsights(budgetInsights));
      insights.push(...this.convertPredictionsToInsights(predictionInsights));

      // Sort by impact and confidence
      return insights.sort((a, b) => {
        const impactWeight = { high: 3, medium: 2, low: 1 };
        const aScore = impactWeight[a.impact] * (a.confidence / 100);
        const bScore = impactWeight[b.impact] * (b.confidence / 100);
        return bScore - aScore;
      });
    } catch (error) {
      console.error("Error generating AI insights:", error);
      return [];
    }
  }

  /**
   * Analyze spending patterns using statistical methods
   */
  private static async analyzeSpendingPatterns(
    transactions: any[]
  ): Promise<SpendingPattern[]> {
    const patterns: SpendingPattern[] = [];

    // Group transactions by category and month
    const categoryMonthly = this.groupTransactionsByCategory(transactions);

    for (const [category, monthlyData] of Object.entries(categoryMonthly)) {
      const amounts = Object.values(monthlyData) as number[];

      if (amounts.length < 3) continue; // Need at least 3 months for pattern analysis

      // Calculate trend
      const trend = this.calculateTrend(amounts);

      // Detect seasonality
      const seasonality = this.detectSeasonality(monthlyData);

      // Calculate confidence based on data consistency
      const confidence = this.calculatePatternConfidence(amounts);

      patterns.push({
        pattern: this.classifyPattern(trend, seasonality),
        category,
        confidence,
        trend: {
          direction: trend.direction,
          percentage: trend.percentage,
          period: "monthly",
        },
        seasonality,
      });
    }

    return patterns;
  }

  /**
   * Analyze card usage optimization opportunities
   */
  private static async analyzeCardOptimization(
    userId: string,
    transactions: any[]
  ): Promise<CardOptimization[]> {
    const optimizations: CardOptimization[] = [];

    // Get user's cards with reward information
    const { data: cards } = await supabase
      .from("credit_cards")
      .select("*")
      .eq("user_id", userId);

    if (!cards?.length) return [];

    // Group transactions by category
    const categorySpending = this.groupTransactionsByCategory(transactions);

    for (const [category, spending] of Object.entries(categorySpending)) {
      const totalSpent = Object.values(spending).reduce(
        (sum, amount) => sum + amount,
        0
      );

      // Find current card usage for this category
      const categoryTransactions = transactions.filter(
        (t) => t.category === category
      );
      const cardUsage = this.analyzeCardUsageByCategory(
        categoryTransactions,
        cards
      );

      // Find optimization opportunities
      const optimization = this.findCardOptimization(
        category,
        totalSpent,
        cardUsage,
        cards
      );

      if (optimization && optimization.improvement.additionalReward > 100) {
        // Minimum ₹100 improvement
        optimizations.push(optimization);
      }
    }

    return optimizations;
  }

  /**
   * Analyze budget trends and patterns
   */
  private static async analyzeBudgetTrends(
    userId: string,
    transactions: any[]
  ): Promise<any> {
    const { data: budgets } = await supabase
      .from("budget_tracking")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12);

    if (!budgets?.length) return null;

    // Analyze budget adherence over time
    const adherencePattern = budgets.map((budget) => {
      const adherence =
        (budget.budget_limit - budget.total_spent) / budget.budget_limit;
      return {
        month: budget.month,
        year: budget.year,
        adherence: adherence * 100,
        overspent: budget.total_spent > budget.budget_limit,
      };
    });

    return {
      averageAdherence:
        adherencePattern.reduce((sum, p) => sum + p.adherence, 0) /
        adherencePattern.length,
      overspendFrequency:
        adherencePattern.filter((p) => p.overspent).length /
        adherencePattern.length,
      trend: this.calculateBudgetTrend(adherencePattern),
      riskMonths: adherencePattern
        .filter((p) => p.adherence < 10)
        .map((p) => `${p.month}/${p.year}`),
    };
  }

  /**
   * Generate predictive insights for future spending
   */
  private static async generatePredictiveInsights(
    transactions: any[]
  ): Promise<SpendingForecast> {
    const monthlySpending = this.groupTransactionsByMonth(transactions);
    const months = Object.keys(monthlySpending).sort();

    if (months.length < 3) {
      throw new Error("Insufficient data for prediction");
    }

    // Use simple linear regression for prediction
    const prediction = this.predictNextMonthSpending(monthlySpending);

    return prediction;
  }

  /**
   * Helper: Group transactions by category and month
   */
  private static groupTransactionsByCategory(
    transactions: any[]
  ): Record<string, Record<string, number>> {
    const grouped: Record<string, Record<string, number>> = {};

    transactions.forEach((transaction) => {
      const category = transaction.category || "Other";
      const monthKey = new Date(transaction.transaction_date)
        .toISOString()
        .slice(0, 7); // YYYY-MM

      if (!grouped[category]) grouped[category] = {};
      if (!grouped[category][monthKey]) grouped[category][monthKey] = 0;

      grouped[category][monthKey] += Math.abs(transaction.amount);
    });

    return grouped;
  }

  /**
   * Helper: Group transactions by month
   */
  private static groupTransactionsByMonth(
    transactions: any[]
  ): Record<string, number> {
    const grouped: Record<string, number> = {};

    transactions.forEach((transaction) => {
      const monthKey = new Date(transaction.transaction_date)
        .toISOString()
        .slice(0, 7);
      if (!grouped[monthKey]) grouped[monthKey] = 0;
      grouped[monthKey] += Math.abs(transaction.amount);
    });

    return grouped;
  }

  /**
   * Helper: Calculate trend direction and percentage
   */
  private static calculateTrend(amounts: number[]): {
    direction: "up" | "down" | "flat";
    percentage: number;
  } {
    if (amounts.length < 2) return { direction: "flat", percentage: 0 };

    const first = amounts[0];
    const last = amounts[amounts.length - 1];
    const percentage = ((last - first) / first) * 100;

    return {
      direction: percentage > 5 ? "up" : percentage < -5 ? "down" : "flat",
      percentage: Math.abs(percentage),
    };
  }

  /**
   * Helper: Detect seasonality patterns
   */
  private static detectSeasonality(monthlyData: Record<string, number>): {
    detected: boolean;
    peak_months: number[];
    low_months: number[];
  } {
    const months = Object.keys(monthlyData).map((key) => ({
      month: parseInt(key.split("-")[1]),
      amount: monthlyData[key],
    }));

    if (months.length < 6) {
      return { detected: false, peak_months: [], low_months: [] };
    }

    const avgByMonth: Record<number, number[]> = {};
    months.forEach(({ month, amount }) => {
      if (!avgByMonth[month]) avgByMonth[month] = [];
      avgByMonth[month].push(amount);
    });

    const monthlyAverages = Object.entries(avgByMonth).map(
      ([month, amounts]) => ({
        month: parseInt(month),
        average: amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length,
      })
    );

    const overallAverage =
      monthlyAverages.reduce((sum, m) => sum + m.average, 0) /
      monthlyAverages.length;

    const peakThreshold = overallAverage * 1.2;
    const lowThreshold = overallAverage * 0.8;

    return {
      detected: monthlyAverages.some(
        (m) => m.average > peakThreshold || m.average < lowThreshold
      ),
      peak_months: monthlyAverages
        .filter((m) => m.average > peakThreshold)
        .map((m) => m.month),
      low_months: monthlyAverages
        .filter((m) => m.average < lowThreshold)
        .map((m) => m.month),
    };
  }

  /**
   * Helper: Calculate pattern confidence
   */
  private static calculatePatternConfidence(amounts: number[]): number {
    if (amounts.length < 2) return 0;

    const mean = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const variance =
      amounts.reduce((sum, amt) => sum + Math.pow(amt - mean, 2), 0) /
      amounts.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / mean;

    // Lower variation = higher confidence
    return Math.max(0, Math.min(100, 100 - coefficientOfVariation * 50));
  }

  /**
   * Helper: Classify spending pattern
   */
  private static classifyPattern(
    trend: any,
    seasonality: any
  ): SpendingPattern["pattern"] {
    if (seasonality.detected) return "seasonal";
    if (trend.direction === "up" && trend.percentage > 20) return "increasing";
    if (trend.direction === "down" && trend.percentage > 20)
      return "decreasing";
    if (trend.direction === "flat") return "stable";
    return "irregular";
  }

  /**
   * Helper: Analyze card usage by category
   */
  private static analyzeCardUsageByCategory(
    transactions: any[],
    cards: any[]
  ): Record<string, { usage: number; rewards: number }> {
    const usage: Record<string, { usage: number; rewards: number }> = {};

    transactions.forEach((transaction) => {
      const cardId = transaction.card_id;
      const amount = Math.abs(transaction.amount);

      if (!usage[cardId]) {
        const card = cards.find((c) => c.id === cardId);
        usage[cardId] = { usage: 0, rewards: 0 };
      }

      usage[cardId].usage += amount;
      // Simplified reward calculation (would be more complex in reality)
      usage[cardId].rewards += amount * 0.01; // Assume 1% default
    });

    return usage;
  }

  /**
   * Helper: Find card optimization opportunity
   */
  private static findCardOptimization(
    category: string,
    totalSpent: number,
    currentUsage: any,
    cards: any[]
  ): CardOptimization | null {
    // Simplified optimization logic
    // In reality, this would involve complex reward rate calculations

    const currentCard = cards[0]; // Simplified: take first card
    const bestCard = cards.find(
      (card) =>
        card.category_rewards &&
        card.category_rewards[category] &&
        card.category_rewards[category] >
          (currentCard.category_rewards?.[category] || 1)
    );

    if (!bestCard || bestCard.id === currentCard.id) return null;

    const currentReward =
      (totalSpent * (currentCard.category_rewards?.[category] || 1)) / 100;
    const potentialReward =
      (totalSpent * (bestCard.category_rewards[category] || 1)) / 100;
    const improvement = potentialReward - currentReward;

    return {
      currentCard: {
        id: currentCard.id,
        name: currentCard.card_name,
        category,
        rewardRate: currentCard.category_rewards?.[category] || 1,
        potentialReward: currentReward,
      },
      recommendedCard: {
        id: bestCard.id,
        name: bestCard.card_name,
        category,
        rewardRate: bestCard.category_rewards[category],
        potentialReward: potentialReward,
      },
      improvement: {
        additionalReward: improvement,
        percentageGain: (improvement / currentReward) * 100,
      },
      confidence: 85, // Simplified confidence score
    };
  }

  /**
   * Helper: Calculate budget trend
   */
  private static calculateBudgetTrend(adherencePattern: any[]): string {
    const recentAdherence = adherencePattern.slice(0, 3);
    const avgRecent =
      recentAdherence.reduce((sum, p) => sum + p.adherence, 0) /
      recentAdherence.length;

    if (avgRecent > 90) return "excellent";
    if (avgRecent > 70) return "good";
    if (avgRecent > 50) return "fair";
    return "needs_improvement";
  }

  /**
   * Helper: Predict next month spending
   */
  private static predictNextMonthSpending(
    monthlySpending: Record<string, number>
  ): SpendingForecast {
    const months = Object.keys(monthlySpending).sort();
    const amounts = months.map((month) => monthlySpending[month]);

    // Simple linear regression prediction
    const n = amounts.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = amounts.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * amounts[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const prediction = intercept + slope * n;

    return {
      period: "next_month",
      totalPredicted: Math.max(0, prediction),
      categoryBreakdown: [], // Simplified for now
      budgetImpact: {
        likelyOverspend: 0,
        riskCategories: [],
        recommendations: [],
      },
    };
  }

  /**
   * Convert spending patterns to insights
   */
  private static convertPatternsToInsights(
    patterns: SpendingPattern[]
  ): FinancialInsight[] {
    return patterns.map((pattern, index) => ({
      id: `pattern_${index}`,
      type: "spending_pattern" as const,
      title: `${pattern.category} Spending Pattern: ${pattern.pattern}`,
      description: this.generatePatternDescription(pattern),
      confidence: pattern.confidence,
      impact:
        pattern.trend.percentage > 50
          ? "high"
          : pattern.trend.percentage > 20
            ? "medium"
            : "low",
      category: pattern.category,
      actionable:
        pattern.pattern === "increasing" || pattern.pattern === "seasonal",
      action:
        pattern.pattern === "increasing"
          ? {
              title: "Review Budget",
              description: `Consider adjusting your ${pattern.category} budget or finding ways to reduce spending.`,
            }
          : undefined,
      metadata: {
        dataPoints: 6, // Simplified
        timeframe: "last_6_months",
        calculatedAt: new Date().toISOString(),
      },
    }));
  }

  /**
   * Convert optimizations to insights
   */
  private static convertOptimizationsToInsights(
    optimizations: CardOptimization[]
  ): FinancialInsight[] {
    return optimizations.map((opt, index) => ({
      id: `optimization_${index}`,
      type: "opportunity" as const,
      title: `Card Optimization Opportunity: ${opt.currentCard.category}`,
      description: `You could earn ₹${opt.improvement.additionalReward.toFixed(0)} more in rewards by using ${opt.recommendedCard.name} for ${opt.currentCard.category} purchases.`,
      confidence: opt.confidence,
      impact:
        opt.improvement.additionalReward > 1000
          ? "high"
          : opt.improvement.additionalReward > 500
            ? "medium"
            : "low",
      category: opt.currentCard.category,
      actionable: true,
      action: {
        title: "Switch Card",
        description: `Use ${opt.recommendedCard.name} for ${opt.currentCard.category} purchases to earn ${opt.recommendedCard.rewardRate}% instead of ${opt.currentCard.rewardRate}%.`,
      },
      metadata: {
        dataPoints: 12, // Simplified
        timeframe: "last_12_months",
        calculatedAt: new Date().toISOString(),
      },
    }));
  }

  /**
   * Convert budget analysis to insights
   */
  private static convertBudgetToInsights(
    budgetAnalysis: any
  ): FinancialInsight[] {
    if (!budgetAnalysis) return [];

    const insights: FinancialInsight[] = [];

    if (budgetAnalysis.overspendFrequency > 0.3) {
      insights.push({
        id: "budget_overspend",
        type: "warning",
        title: "Frequent Budget Overspending",
        description: `You've exceeded your budget in ${(budgetAnalysis.overspendFrequency * 100).toFixed(0)}% of recent months.`,
        confidence: 95,
        impact: "high",
        actionable: true,
        action: {
          title: "Adjust Budget",
          description:
            "Consider increasing your budget or reviewing spending in high-spend categories.",
        },
        metadata: {
          dataPoints: 12,
          timeframe: "last_12_months",
          calculatedAt: new Date().toISOString(),
        },
      });
    }

    if (budgetAnalysis.averageAdherence > 85) {
      insights.push({
        id: "budget_success",
        type: "optimization",
        title: "Excellent Budget Management",
        description: `You maintain ${budgetAnalysis.averageAdherence.toFixed(0)}% budget adherence on average. Great job!`,
        confidence: 90,
        impact: "medium",
        actionable: false,
        metadata: {
          dataPoints: 12,
          timeframe: "last_12_months",
          calculatedAt: new Date().toISOString(),
        },
      });
    }

    return insights;
  }

  /**
   * Convert predictions to insights
   */
  private static convertPredictionsToInsights(
    predictions: SpendingForecast
  ): FinancialInsight[] {
    return [
      {
        id: "spending_prediction",
        type: "prediction",
        title: "Next Month Spending Forecast",
        description: `Based on your spending patterns, you're likely to spend ₹${predictions.totalPredicted.toFixed(0)} next month.`,
        confidence: 75,
        impact: "medium",
        actionable: true,
        action: {
          title: "Plan Budget",
          description:
            "Review this prediction against your planned budget for next month.",
        },
        metadata: {
          dataPoints: 12,
          timeframe: "next_month",
          calculatedAt: new Date().toISOString(),
        },
      },
    ];
  }

  /**
   * Generate description for spending pattern
   */
  private static generatePatternDescription(pattern: SpendingPattern): string {
    switch (pattern.pattern) {
      case "increasing":
        return `Your ${pattern.category} spending has been increasing by ${pattern.trend.percentage.toFixed(1)}% over recent months.`;
      case "decreasing":
        return `Your ${pattern.category} spending has been decreasing by ${pattern.trend.percentage.toFixed(1)}% over recent months.`;
      case "seasonal":
        return `Your ${pattern.category} spending follows a seasonal pattern with peaks in certain months.`;
      case "stable":
        return `Your ${pattern.category} spending has remained relatively stable over recent months.`;
      default:
        return `Your ${pattern.category} spending shows irregular patterns that may need attention.`;
    }
  }

  /**
   * Get insights for specific category
   */
  static async getCategoryInsights(
    userId: string,
    category: string
  ): Promise<FinancialInsight[]> {
    const allInsights = await this.generateInsights(userId);
    return allInsights.filter((insight) => insight.category === category);
  }

  /**
   * Get actionable insights only
   */
  static async getActionableInsights(
    userId: string
  ): Promise<FinancialInsight[]> {
    const allInsights = await this.generateInsights(userId);
    return allInsights.filter((insight) => insight.actionable);
  }

  /**
   * Get high-impact insights
   */
  static async getHighImpactInsights(
    userId: string
  ): Promise<FinancialInsight[]> {
    const allInsights = await this.generateInsights(userId);
    return allInsights.filter((insight) => insight.impact === "high");
  }

  /**
   * Generate custom insights with specific parameters
   */
  static async generateCustomInsights(
    userId: string,
    options: {
      dateRange?: { start: string; end: string };
      categories?: string[];
      analysisType?: "spending" | "budgeting" | "recommendations" | "all";
      forceRefresh?: boolean;
    }
  ): Promise<FinancialInsight[]> {
    try {
      // Get user data with optional filtering
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId);

      // Apply date range filter if provided
      if (options.dateRange) {
        query = query
          .gte("date", options.dateRange.start)
          .lte("date", options.dateRange.end);
      }

      // Apply category filter if provided
      if (options.categories && options.categories.length > 0) {
        query = query.in("category", options.categories);
      }

      const { data: transactions, error } = await query;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      if (!transactions || transactions.length === 0) {
        return [];
      }

      // Generate insights based on analysis type
      const insights: FinancialInsight[] = [];

      if (
        options.analysisType === "all" ||
        options.analysisType === "spending"
      ) {
        const spendingInsights =
          await this.generateSpendingInsights(transactions);
        insights.push(...spendingInsights);
      }

      if (
        options.analysisType === "all" ||
        options.analysisType === "budgeting"
      ) {
        const budgetInsights = await this.generateBudgetInsights(
          userId,
          transactions
        );
        insights.push(...budgetInsights);
      }

      if (
        options.analysisType === "all" ||
        options.analysisType === "recommendations"
      ) {
        const recommendationInsights =
          await this.generateRecommendationInsights(transactions);
        insights.push(...recommendationInsights);
      }

      // Sort by confidence and impact
      return insights.sort((a, b) => {
        const impactWeight = { high: 3, medium: 2, low: 1 };
        const aScore = a.confidence + impactWeight[a.impact] * 10;
        const bScore = b.confidence + impactWeight[b.impact] * 10;
        return bScore - aScore;
      });
    } catch (error) {
      console.error("Error generating custom insights:", error);
      throw error;
    }
  }

  /**
   * Detect transaction anomalies and suspicious patterns
   */
  static async detectAnomalies(
    userId: string,
    options: {
      severity?: string;
      limit?: number;
      dateRange?: { start: string; end: string };
    }
  ): Promise<TransactionAnomaly[]> {
    try {
      // Get recent transaction data
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false });

      // Apply date range if provided
      if (options.dateRange) {
        query = query
          .gte("date", options.dateRange.start)
          .lte("date", options.dateRange.end);
      }

      const { data: transactions, error } = await query.limit(1000);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      if (!transactions || transactions.length === 0) {
        return [];
      }

      const anomalies: TransactionAnomaly[] = [];

      // 1. Amount-based anomalies
      const amountAnomalies = this.detectAmountAnomalies(transactions);
      anomalies.push(...amountAnomalies);

      // 2. Time-based anomalies
      const timeAnomalies = this.detectTimeAnomalies(transactions);
      anomalies.push(...timeAnomalies);

      // 3. Location-based anomalies
      const locationAnomalies = this.detectLocationAnomalies(transactions);
      anomalies.push(...locationAnomalies);

      // 4. Frequency-based anomalies
      const frequencyAnomalies = this.detectFrequencyAnomalies(transactions);
      anomalies.push(...frequencyAnomalies);

      // Filter by severity if specified
      let filteredAnomalies = anomalies;
      if (options.severity && options.severity !== "all") {
        filteredAnomalies = anomalies.filter(
          (a) => a.severity === options.severity
        );
      }

      // Sort by risk score and apply limit
      filteredAnomalies.sort((a, b) => b.riskScore - a.riskScore);

      return filteredAnomalies.slice(0, options.limit || 20);
    } catch (error) {
      console.error("Error detecting anomalies:", error);
      throw error;
    }
  }

  /**
   * Detect amount-based anomalies
   */
  private static detectAmountAnomalies(
    transactions: any[]
  ): TransactionAnomaly[] {
    const anomalies: TransactionAnomaly[] = [];

    // Group by category and calculate statistics
    const categoryStats = new Map<
      string,
      { amounts: number[]; avg: number; std: number }
    >();

    transactions.forEach((tx) => {
      if (!categoryStats.has(tx.category)) {
        categoryStats.set(tx.category, { amounts: [], avg: 0, std: 0 });
      }
      categoryStats.get(tx.category)!.amounts.push(Math.abs(tx.amount));
    });

    // Calculate averages and standard deviations
    categoryStats.forEach((stats, category) => {
      stats.avg =
        stats.amounts.reduce((sum, amt) => sum + amt, 0) / stats.amounts.length;
      const variance =
        stats.amounts.reduce(
          (sum, amt) => sum + Math.pow(amt - stats.avg, 2),
          0
        ) / stats.amounts.length;
      stats.std = Math.sqrt(variance);
    });

    // Find outliers
    transactions.forEach((tx) => {
      const stats = categoryStats.get(tx.category);
      if (stats && stats.std > 0) {
        const amount = Math.abs(tx.amount);
        const zScore = (amount - stats.avg) / stats.std;

        if (zScore > 2.5) {
          // More than 2.5 standard deviations
          let severity: "low" | "medium" | "high" | "critical" = "low";
          let riskScore = Math.min(100, zScore * 20);

          if (zScore > 4) {
            severity = "critical";
            riskScore = 100;
          } else if (zScore > 3.5) {
            severity = "high";
          } else if (zScore > 3) {
            severity = "medium";
          }

          anomalies.push({
            id: `amount_${tx.id}`,
            transactionId: tx.id,
            type: "unusual_amount",
            severity,
            description: `Unusually ${amount > stats.avg ? "large" : "small"} transaction amount for ${tx.category}`,
            riskScore,
            details: {
              amount: tx.amount,
              categoryAverage: stats.avg,
              standardDeviations: Math.round(zScore * 100) / 100,
            },
            detectedAt: new Date().toISOString(),
          });
        }
      }
    });

    return anomalies;
  }

  /**
   * Detect time-based anomalies
   */
  private static detectTimeAnomalies(
    transactions: any[]
  ): TransactionAnomaly[] {
    const anomalies: TransactionAnomaly[] = [];

    // Group transactions by hour to find unusual timing
    const hourCounts = new Map<number, number>();
    transactions.forEach((tx) => {
      const hour = new Date(tx.date).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });

    // Find transactions at very unusual hours (very late night/early morning)
    transactions.forEach((tx) => {
      const hour = new Date(tx.date).getHours();
      const totalTransactions = transactions.length;
      const hourCount = hourCounts.get(hour) || 0;
      const hourFrequency = hourCount / totalTransactions;

      // Flag transactions between 1-5 AM as potentially suspicious
      if (hour >= 1 && hour <= 5 && hourFrequency < 0.02) {
        anomalies.push({
          id: `time_${tx.id}`,
          transactionId: tx.id,
          type: "unusual_time",
          severity: "medium",
          description: `Transaction occurred at unusual hour (${hour}:00)`,
          riskScore: 60,
          details: {
            hour,
            frequency: Math.round(hourFrequency * 100 * 100) / 100,
          },
          detectedAt: new Date().toISOString(),
        });
      }
    });

    return anomalies;
  }

  /**
   * Detect location-based anomalies
   */
  private static detectLocationAnomalies(
    transactions: any[]
  ): TransactionAnomaly[] {
    const anomalies: TransactionAnomaly[] = [];

    // Group by merchant to detect unusual locations
    const merchantCounts = new Map<string, number>();
    transactions.forEach((tx) => {
      if (tx.merchant) {
        merchantCounts.set(
          tx.merchant,
          (merchantCounts.get(tx.merchant) || 0) + 1
        );
      }
    });

    // Flag one-time merchants with large amounts as potentially suspicious
    transactions.forEach((tx) => {
      if (
        tx.merchant &&
        merchantCounts.get(tx.merchant) === 1 &&
        Math.abs(tx.amount) > 500
      ) {
        anomalies.push({
          id: `location_${tx.id}`,
          transactionId: tx.id,
          type: "unusual_merchant",
          severity: "medium",
          description: `Large transaction with new/unusual merchant: ${tx.merchant}`,
          riskScore: 50,
          details: {
            merchant: tx.merchant,
            amount: tx.amount,
            isFirstTime: true,
          },
          detectedAt: new Date().toISOString(),
        });
      }
    });

    return anomalies;
  }

  /**
   * Detect frequency-based anomalies
   */
  private static detectFrequencyAnomalies(
    transactions: any[]
  ): TransactionAnomaly[] {
    const anomalies: TransactionAnomaly[] = [];

    // Group by merchant and date to detect rapid successive transactions
    const merchantDates = new Map<string, Date[]>();

    transactions.forEach((tx) => {
      if (tx.merchant) {
        if (!merchantDates.has(tx.merchant)) {
          merchantDates.set(tx.merchant, []);
        }
        merchantDates.get(tx.merchant)!.push(new Date(tx.date));
      }
    });

    // Check for multiple transactions at same merchant within short time
    merchantDates.forEach((dates, merchant) => {
      if (dates.length > 1) {
        dates.sort((a, b) => a.getTime() - b.getTime());

        for (let i = 1; i < dates.length; i++) {
          const timeDiff = dates[i].getTime() - dates[i - 1].getTime();
          const minutesDiff = timeDiff / (1000 * 60);

          if (minutesDiff < 30) {
            // Less than 30 minutes apart
            const relatedTx = transactions.find(
              (tx) =>
                tx.merchant === merchant &&
                new Date(tx.date).getTime() === dates[i].getTime()
            );

            if (relatedTx) {
              anomalies.push({
                id: `frequency_${relatedTx.id}`,
                transactionId: relatedTx.id,
                type: "rapid_succession",
                severity: "high",
                description: `Multiple transactions at ${merchant} within ${Math.round(minutesDiff)} minutes`,
                riskScore: 75,
                details: {
                  merchant,
                  minutesApart: Math.round(minutesDiff),
                  consecutiveTransactions: true,
                },
                detectedAt: new Date().toISOString(),
              });
            }
          }
        }
      }
    });

    return anomalies;
  }

  /**
   * Generate spending-focused insights
   */
  private static async generateSpendingInsights(
    transactions: any[]
  ): Promise<FinancialInsight[]> {
    // Implementation would analyze spending patterns
    // This is a simplified version - you can expand based on existing logic
    return [];
  }

  /**
   * Generate budget-focused insights
   */
  private static async generateBudgetInsights(
    userId: string,
    transactions: any[]
  ): Promise<FinancialInsight[]> {
    // Implementation would analyze budget adherence
    // This is a simplified version - you can expand based on existing logic
    return [];
  }

  /**
   * Generate recommendation insights
   */
  private static async generateRecommendationInsights(
    transactions: any[]
  ): Promise<FinancialInsight[]> {
    // Implementation would generate actionable recommendations
    // This is a simplified version - you can expand based on existing logic
    return [];
  }
}


// Export singleton instance
export const aIInsightsService = new AIInsightsService();
