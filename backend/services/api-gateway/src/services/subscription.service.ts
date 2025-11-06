import { supabase } from "../../../../shared/database/supabase";

/**
 * Detected subscription information
 */
export interface DetectedSubscription {
  id: string;
  user_id: string;
  merchant_name: string;
  amount: number;
  frequency: "weekly" | "monthly" | "quarterly" | "annually";
  status: "active" | "inactive" | "cancelled" | "pending_confirmation";
  category: string;
  first_detected: string;
  last_transaction: string;
  next_expected: string;
  confidence_score: number; // 0-100
  transaction_count: number;
  average_amount: number;
  amount_variance: number; // How much the amount varies
  billing_cycle_day?: number; // Day of month for monthly subscriptions
  metadata: {
    detection_method: "pattern" | "merchant_name" | "manual";
    similar_transactions: number;
    pattern_strength: number;
    anomaly_flags: string[];
  };
}

/**
 * Subscription management settings
 */
export interface SubscriptionSettings {
  user_id: string;
  auto_detect_enabled: boolean;
  notification_preferences: {
    new_subscription_alert: boolean;
    amount_change_alert: boolean;
    missed_payment_alert: boolean;
    cancellation_alert: boolean;
  };
  detection_sensitivity: "low" | "medium" | "high";
  minimum_amount: number; // Minimum amount to consider for subscription detection
  minimum_frequency: number; // Minimum number of transactions to detect pattern
}

/**
 * Subscription category mapping
 */
export interface SubscriptionCategory {
  name: string;
  patterns: string[];
  typical_amounts: { min: number; max: number };
  common_billing_cycles: string[];
}

/**
 * Subscription Service - Automated subscription detection and management
 */
export class SubscriptionService {
  // Common subscription merchant patterns
  private static readonly SUBSCRIPTION_PATTERNS = [
    // Streaming Services
    {
      pattern: /netflix|prime video|disney|hotstar|zee5|voot|sony liv/i,
      category: "Entertainment",
    },
    {
      pattern: /spotify|gaana|jiosaavn|wynk|amazon music|apple music/i,
      category: "Music",
    },

    // Software & Apps
    {
      pattern:
        /adobe|microsoft office|google workspace|dropbox|icloud|onedrive/i,
      category: "Software",
    },
    {
      pattern: /github|gitlab|aws|azure|google cloud/i,
      category: "Developer Tools",
    },

    // Communication
    {
      pattern: /whatsapp business|zoom|teams|slack|skype/i,
      category: "Communication",
    },

    // Utilities & Services
    {
      pattern:
        /electricity|gas|water|internet|broadband|mobile|airtel|jio|vodafone/i,
      category: "Utilities",
    },

    // Fitness & Health
    {
      pattern: /gym|fitness|yoga|cult\.fit|gold's gym|anytime fitness/i,
      category: "Fitness",
    },

    // Food & Delivery
    {
      pattern: /swiggy one|zomato pro|amazon fresh|bigbasket/i,
      category: "Food & Delivery",
    },

    // Transportation
    {
      pattern: /uber pass|ola select|metro card|bus pass/i,
      category: "Transportation",
    },

    // Insurance & Finance
    {
      pattern: /life insurance|health insurance|car insurance|mutual fund|sip/i,
      category: "Insurance & Finance",
    },

    // News & Media
    {
      pattern: /times of india|hindu|mint|economic times|the wire/i,
      category: "News & Media",
    },
  ];

  /**
   * Detect subscriptions for a user
   */
  static async detectSubscriptions(
    userId: string
  ): Promise<DetectedSubscription[]> {
    try {
      // Get transactions from last 24 months for pattern analysis
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .gte(
          "transaction_date",
          new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000).toISOString()
        )
        .order("transaction_date", { ascending: false });

      if (error || !transactions?.length) {
        return [];
      }

      // Group transactions by merchant and analyze patterns
      const merchantGroups = this.groupTransactionsByMerchant(transactions);
      const detectedSubscriptions: DetectedSubscription[] = [];

      for (const [merchantName, merchantTransactions] of Object.entries(
        merchantGroups
      )) {
        const subscription = await this.analyzeSubscriptionPattern(
          userId,
          merchantName,
          merchantTransactions
        );

        if (subscription) {
          detectedSubscriptions.push(subscription);
        }
      }

      // Save detected subscriptions to database
      await this.saveDetectedSubscriptions(detectedSubscriptions);

      return detectedSubscriptions.sort(
        (a, b) => b.confidence_score - a.confidence_score
      );
    } catch (error) {
      console.error("Error detecting subscriptions:", error);
      return [];
    }
  }

  /**
   * Get user's confirmed subscriptions
   */
  static async getUserSubscriptions(
    userId: string
  ): Promise<DetectedSubscription[]> {
    try {
      const { data: subscriptions, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .neq("status", "cancelled")
        .order("last_transaction", { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch subscriptions: ${error.message}`);
      }

      return subscriptions || [];
    } catch (error) {
      console.error("Error fetching user subscriptions:", error);
      throw error;
    }
  }

  /**
   * Update subscription status
   */
  static async updateSubscriptionStatus(
    subscriptionId: string,
    userId: string,
    status: DetectedSubscription["status"]
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscriptionId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(`Failed to update subscription: ${error.message}`);
      }
    } catch (error) {
      console.error("Error updating subscription status:", error);
      throw error;
    }
  }

  /**
   * Get subscription insights and analytics
   */
  static async getSubscriptionInsights(userId: string): Promise<{
    totalMonthlySpend: number;
    totalAnnualSpend: number;
    subscriptionCount: number;
    categoryBreakdown: { category: string; amount: number; count: number }[];
    trends: {
      monthlyGrowth: number;
      newThisMonth: number;
      cancelledThisMonth: number;
    };
    recommendations: string[];
  }> {
    try {
      const subscriptions = await this.getUserSubscriptions(userId);

      if (!subscriptions.length) {
        return {
          totalMonthlySpend: 0,
          totalAnnualSpend: 0,
          subscriptionCount: 0,
          categoryBreakdown: [],
          trends: { monthlyGrowth: 0, newThisMonth: 0, cancelledThisMonth: 0 },
          recommendations: [],
        };
      }

      // Calculate monthly spend
      const monthlySpend = subscriptions.reduce((total, sub) => {
        return total + this.calculateMonthlyAmount(sub.amount, sub.frequency);
      }, 0);

      // Group by category
      const categoryMap = new Map<string, { amount: number; count: number }>();
      subscriptions.forEach((sub) => {
        const monthlyAmount = this.calculateMonthlyAmount(
          sub.amount,
          sub.frequency
        );
        const existing = categoryMap.get(sub.category) || {
          amount: 0,
          count: 0,
        };
        categoryMap.set(sub.category, {
          amount: existing.amount + monthlyAmount,
          count: existing.count + 1,
        });
      });

      const categoryBreakdown = Array.from(categoryMap.entries()).map(
        ([category, data]) => ({
          category,
          amount: data.amount,
          count: data.count,
        })
      );

      // Calculate trends (simplified)
      const currentMonth = new Date().toISOString().slice(0, 7);
      const newThisMonth = subscriptions.filter((sub) =>
        sub.first_detected.startsWith(currentMonth)
      ).length;

      // Generate recommendations
      const recommendations = this.generateSubscriptionRecommendations(
        subscriptions,
        categoryBreakdown
      );

      return {
        totalMonthlySpend: monthlySpend,
        totalAnnualSpend: monthlySpend * 12,
        subscriptionCount: subscriptions.length,
        categoryBreakdown,
        trends: {
          monthlyGrowth: 0, // Simplified
          newThisMonth,
          cancelledThisMonth: 0, // Would need historical data
        },
        recommendations,
      };
    } catch (error) {
      console.error("Error getting subscription insights:", error);
      throw error;
    }
  }

  /**
   * Get upcoming subscription renewals
   */
  static async getUpcomingRenewals(
    userId: string,
    daysAhead: number = 7
  ): Promise<
    {
      subscription: DetectedSubscription;
      daysUntilRenewal: number;
      estimatedAmount: number;
    }[]
  > {
    try {
      const subscriptions = await this.getUserSubscriptions(userId);
      const now = new Date();
      const futureDate = new Date(
        now.getTime() + daysAhead * 24 * 60 * 60 * 1000
      );

      const upcomingRenewals = subscriptions
        .map((subscription) => {
          const nextExpected = new Date(subscription.next_expected);
          const daysUntilRenewal = Math.ceil(
            (nextExpected.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
          );

          return {
            subscription,
            daysUntilRenewal,
            estimatedAmount: subscription.average_amount,
          };
        })
        .filter(
          (renewal) =>
            renewal.daysUntilRenewal >= 0 &&
            renewal.daysUntilRenewal <= daysAhead
        )
        .sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);

      return upcomingRenewals;
    } catch (error) {
      console.error("Error getting upcoming renewals:", error);
      throw error;
    }
  }

  /**
   * Cancel or mark subscription as inactive
   */
  static async cancelSubscription(
    subscriptionId: string,
    userId: string
  ): Promise<void> {
    await this.updateSubscriptionStatus(subscriptionId, userId, "cancelled");
  }

  /**
   * Manually add a subscription
   */
  static async addManualSubscription(
    userId: string,
    subscriptionData: {
      merchantName: string;
      amount: number;
      frequency: DetectedSubscription["frequency"];
      category: string;
      billingCycleDay?: number;
    }
  ): Promise<DetectedSubscription> {
    try {
      const subscription: Omit<DetectedSubscription, "id"> = {
        user_id: userId,
        merchant_name: subscriptionData.merchantName,
        amount: subscriptionData.amount,
        frequency: subscriptionData.frequency,
        status: "active",
        category: subscriptionData.category,
        first_detected: new Date().toISOString(),
        last_transaction: new Date().toISOString(),
        next_expected: this.calculateNextExpected(
          new Date(),
          subscriptionData.frequency,
          subscriptionData.billingCycleDay
        ).toISOString(),
        confidence_score: 100, // Manual entries have 100% confidence
        transaction_count: 1,
        average_amount: subscriptionData.amount,
        amount_variance: 0,
        billing_cycle_day: subscriptionData.billingCycleDay,
        metadata: {
          detection_method: "manual",
          similar_transactions: 1,
          pattern_strength: 100,
          anomaly_flags: [],
        },
      };

      const { data, error } = await supabase
        .from("subscriptions")
        .insert([subscription])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to add subscription: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Error adding manual subscription:", error);
      throw error;
    }
  }

  /**
   * Private: Group transactions by merchant
   */
  private static groupTransactionsByMerchant(
    transactions: any[]
  ): Record<string, any[]> {
    const groups: Record<string, any[]> = {};

    transactions.forEach((transaction) => {
      const merchantName = this.normalizeMerchantName(
        transaction.merchant_name
      );
      if (!groups[merchantName]) {
        groups[merchantName] = [];
      }
      groups[merchantName].push(transaction);
    });

    return groups;
  }

  /**
   * Private: Normalize merchant name for better grouping
   */
  private static normalizeMerchantName(merchantName: string): string {
    return merchantName
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Private: Analyze subscription pattern for a merchant
   */
  private static async analyzeSubscriptionPattern(
    userId: string,
    merchantName: string,
    transactions: any[]
  ): Promise<DetectedSubscription | null> {
    // Need at least 2 transactions to detect a pattern
    if (transactions.length < 2) {
      return null;
    }

    // Sort transactions by date
    transactions.sort(
      (a, b) =>
        new Date(a.transaction_date).getTime() -
        new Date(b.transaction_date).getTime()
    );

    // Analyze transaction intervals
    const intervals: number[] = [];
    for (let i = 1; i < transactions.length; i++) {
      const prev = new Date(transactions[i - 1].transaction_date);
      const current = new Date(transactions[i].transaction_date);
      const daysDiff = Math.round(
        (current.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000)
      );
      intervals.push(daysDiff);
    }

    // Determine frequency pattern
    const frequency = this.detectFrequencyPattern(intervals);
    if (!frequency) {
      return null; // No clear pattern detected
    }

    // Calculate pattern strength and confidence
    const patternStrength = this.calculatePatternStrength(intervals, frequency);
    if (patternStrength < 60) {
      return null; // Pattern not strong enough
    }

    // Analyze amounts
    const amounts = transactions.map((t) => Math.abs(t.amount));
    const averageAmount =
      amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const amountVariance = this.calculateAmountVariance(amounts);

    // Detect category
    const category = this.detectSubscriptionCategory(merchantName);

    // Calculate next expected date
    const lastTransaction = new Date(
      transactions[transactions.length - 1].transaction_date
    );
    const nextExpected = this.calculateNextExpected(lastTransaction, frequency);

    // Generate confidence score
    const confidenceScore = this.calculateConfidenceScore({
      transactionCount: transactions.length,
      patternStrength,
      amountVariance,
      merchantName,
    });

    // Only return if confidence is high enough
    if (confidenceScore < 70) {
      return null;
    }

    return {
      id: "", // Will be set when saved
      user_id: userId,
      merchant_name: transactions[0].merchant_name, // Use original name
      amount: averageAmount,
      frequency,
      status: "pending_confirmation",
      category,
      first_detected: transactions[0].transaction_date,
      last_transaction: transactions[transactions.length - 1].transaction_date,
      next_expected: nextExpected.toISOString(),
      confidence_score: confidenceScore,
      transaction_count: transactions.length,
      average_amount: averageAmount,
      amount_variance: amountVariance,
      billing_cycle_day: this.extractBillingCycleDay(transactions),
      metadata: {
        detection_method: "pattern",
        similar_transactions: transactions.length,
        pattern_strength: patternStrength,
        anomaly_flags: this.detectAnomalies(transactions),
      },
    };
  }

  /**
   * Private: Detect frequency pattern from intervals
   */
  private static detectFrequencyPattern(
    intervals: number[]
  ): DetectedSubscription["frequency"] | null {
    const avgInterval =
      intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;

    // Weekly (7 ± 2 days)
    if (avgInterval >= 5 && avgInterval <= 9) {
      return "weekly";
    }

    // Monthly (30 ± 5 days)
    if (avgInterval >= 25 && avgInterval <= 35) {
      return "monthly";
    }

    // Quarterly (90 ± 10 days)
    if (avgInterval >= 80 && avgInterval <= 100) {
      return "quarterly";
    }

    // Annually (365 ± 20 days)
    if (avgInterval >= 345 && avgInterval <= 385) {
      return "annually";
    }

    return null;
  }

  /**
   * Private: Calculate pattern strength (0-100)
   */
  private static calculatePatternStrength(
    intervals: number[],
    frequency: DetectedSubscription["frequency"]
  ): number {
    const expectedInterval = {
      weekly: 7,
      monthly: 30,
      quarterly: 90,
      annually: 365,
    }[frequency];

    const deviations = intervals.map(
      (interval) => Math.abs(interval - expectedInterval) / expectedInterval
    );

    const avgDeviation =
      deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;

    // Convert to 0-100 scale (lower deviation = higher strength)
    return Math.max(0, Math.min(100, 100 - avgDeviation * 100));
  }

  /**
   * Private: Calculate amount variance (0-100)
   */
  private static calculateAmountVariance(amounts: number[]): number {
    if (amounts.length < 2) return 0;

    const mean = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const variance =
      amounts.reduce((sum, amt) => sum + Math.pow(amt - mean, 2), 0) /
      amounts.length;
    const stdDev = Math.sqrt(variance);

    // Return coefficient of variation as percentage
    return (stdDev / mean) * 100;
  }

  /**
   * Private: Detect subscription category
   */
  private static detectSubscriptionCategory(merchantName: string): string {
    for (const { pattern, category } of this.SUBSCRIPTION_PATTERNS) {
      if (pattern.test(merchantName)) {
        return category;
      }
    }
    return "Other";
  }

  /**
   * Private: Calculate next expected date
   */
  private static calculateNextExpected(
    lastDate: Date,
    frequency: DetectedSubscription["frequency"],
    billingCycleDay?: number
  ): Date {
    const nextDate = new Date(lastDate);

    switch (frequency) {
      case "weekly":
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case "monthly":
        if (billingCycleDay) {
          nextDate.setMonth(nextDate.getMonth() + 1);
          nextDate.setDate(billingCycleDay);
        } else {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }
        break;
      case "quarterly":
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case "annually":
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }

    return nextDate;
  }

  /**
   * Private: Calculate confidence score
   */
  private static calculateConfidenceScore(factors: {
    transactionCount: number;
    patternStrength: number;
    amountVariance: number;
    merchantName: string;
  }): number {
    let confidence = 0;

    // Transaction count factor (0-30 points)
    confidence += Math.min(30, factors.transactionCount * 5);

    // Pattern strength factor (0-40 points)
    confidence += (factors.patternStrength / 100) * 40;

    // Amount consistency factor (0-20 points)
    const amountConsistency = Math.max(0, 100 - factors.amountVariance);
    confidence += (amountConsistency / 100) * 20;

    // Known subscription merchant bonus (0-10 points)
    if (this.detectSubscriptionCategory(factors.merchantName) !== "Other") {
      confidence += 10;
    }

    return Math.min(100, Math.round(confidence));
  }

  /**
   * Private: Extract billing cycle day from transactions
   */
  private static extractBillingCycleDay(
    transactions: any[]
  ): number | undefined {
    const days = transactions.map((t) =>
      new Date(t.transaction_date).getDate()
    );

    // Find the most common day
    const dayCount = days.reduce(
      (acc, day) => {
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>
    );

    const mostCommonDay = Object.entries(dayCount).sort(
      ([, a], [, b]) => b - a
    )[0];

    return mostCommonDay ? parseInt(mostCommonDay[0]) : undefined;
  }

  /**
   * Private: Detect anomalies in transaction pattern
   */
  private static detectAnomalies(transactions: any[]): string[] {
    const anomalies: string[] = [];

    const amounts = transactions.map((t) => Math.abs(t.amount));
    const avgAmount =
      amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;

    // Check for significant amount changes
    for (let i = 1; i < amounts.length; i++) {
      const change = Math.abs(amounts[i] - amounts[i - 1]) / amounts[i - 1];
      if (change > 0.2) {
        // More than 20% change
        anomalies.push("amount_variation");
        break;
      }
    }

    // Check for missing transactions (gaps larger than expected)
    // This would require more complex logic based on expected frequency

    return anomalies;
  }

  /**
   * Private: Save detected subscriptions
   */
  private static async saveDetectedSubscriptions(
    subscriptions: DetectedSubscription[]
  ): Promise<void> {
    if (!subscriptions.length) return;

    try {
      // Check for existing subscriptions to avoid duplicates
      const { data: existing } = await supabase
        .from("subscriptions")
        .select("user_id, merchant_name")
        .in(
          "user_id",
          subscriptions.map((s) => s.user_id)
        );

      const existingKeys = new Set(
        existing?.map(
          (e) => `${e.user_id}_${this.normalizeMerchantName(e.merchant_name)}`
        ) || []
      );

      const newSubscriptions = subscriptions.filter(
        (sub) =>
          !existingKeys.has(
            `${sub.user_id}_${this.normalizeMerchantName(sub.merchant_name)}`
          )
      );

      if (newSubscriptions.length > 0) {
        const { error } = await supabase
          .from("subscriptions")
          .insert(newSubscriptions);

        if (error) {
          console.error("Error saving subscriptions:", error);
        }
      }
    } catch (error) {
      console.error("Error saving detected subscriptions:", error);
    }
  }

  /**
   * Private: Calculate monthly amount from any frequency
   */
  private static calculateMonthlyAmount(
    amount: number,
    frequency: DetectedSubscription["frequency"]
  ): number {
    switch (frequency) {
      case "weekly":
        return amount * 4.33; // Average weeks per month
      case "monthly":
        return amount;
      case "quarterly":
        return amount / 3;
      case "annually":
        return amount / 12;
      default:
        return amount;
    }
  }

  /**
   * Private: Generate subscription recommendations
   */
  private static generateSubscriptionRecommendations(
    subscriptions: DetectedSubscription[],
    categoryBreakdown: { category: string; amount: number; count: number }[]
  ): string[] {
    const recommendations: string[] = [];

    // High spending category recommendation
    const topCategory = categoryBreakdown.sort(
      (a, b) => b.amount - a.amount
    )[0];
    if (topCategory && topCategory.amount > 2000) {
      recommendations.push(
        `You spend ₹${topCategory.amount.toFixed(0)}/month on ${topCategory.category} subscriptions. Consider reviewing if all are necessary.`
      );
    }

    // Multiple similar services
    const entertainmentSubs = subscriptions.filter(
      (sub) => sub.category === "Entertainment" && sub.status === "active"
    );
    if (entertainmentSubs.length > 3) {
      recommendations.push(
        `You have ${entertainmentSubs.length} entertainment subscriptions. Consider consolidating to save money.`
      );
    }

    // Annual vs monthly billing
    const monthlySubs = subscriptions.filter(
      (sub) => sub.frequency === "monthly" && sub.status === "active"
    );
    if (monthlySubs.length > 2) {
      recommendations.push(
        "Consider switching to annual billing for long-term subscriptions to save 10-20%."
      );
    }

    // Unused subscriptions (simplified)
    const oldSubs = subscriptions.filter((sub) => {
      const lastTransaction = new Date(sub.last_transaction);
      const daysSinceLastTransaction = Math.floor(
        (Date.now() - lastTransaction.getTime()) / (24 * 60 * 60 * 1000)
      );
      return daysSinceLastTransaction > 60; // No transaction in 60 days
    });

    if (oldSubs.length > 0) {
      recommendations.push(
        `${oldSubs.length} subscription(s) haven't been used recently. Consider cancelling unused services.`
      );
    }

    return recommendations;
  }
}
