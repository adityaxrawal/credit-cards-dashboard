import { supabase } from "shared/database/supabase";

// Helper function to subtract months from a date
function subMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
}

/**
 * Reward types and their characteristics
 */
export interface RewardProgram {
  id: string;
  cardId: string;
  type: "cashback" | "points" | "miles" | "custom";
  name: string;
  baseRate: number; // Base reward rate (e.g., 1% = 1.0)
  categoryRates: { [category: string]: number }; // Category-specific rates
  bonusCategories: string[]; // Categories with bonus rewards
  redemptionOptions: {
    type: string;
    value: number; // Value per point/mile in INR
    minimumRedemption?: number;
    description: string;
  }[];
  annualFee?: number;
  rewardCaps?: { [category: string]: number }; // Monthly/annual caps
  expirationPolicy?: {
    expiresAfterMonths?: number;
    description: string;
  };
}

/**
 * Earned rewards data
 */
export interface EarnedReward {
  id: string;
  userId: string;
  cardId: string;
  transactionId?: string;
  rewardType: "cashback" | "points" | "miles";
  amount: number; // Amount of reward earned
  category: string;
  earnedDate: string;
  expirationDate?: string;
  status: "active" | "redeemed" | "expired";
  redemptionId?: string;
}

/**
 * Reward redemption tracking
 */
export interface RewardRedemption {
  id: string;
  userId: string;
  cardId: string;
  rewardType: "cashback" | "points" | "miles";
  amountRedeemed: number;
  redemptionValue: number; // Value in INR
  redemptionMethod: string;
  redeemedAt: string;
  description: string;
}

/**
 * Optimization recommendations
 */
export interface RewardOptimizationTip {
  id: string;
  type:
    | "card_recommendation"
    | "category_optimization"
    | "redemption_strategy"
    | "timing_optimization";
  title: string;
  description: string;
  potentialBenefit: number; // Estimated annual benefit in INR
  confidence: number; // 0-100
  actionRequired: string;
  priority: "high" | "medium" | "low";
  category?: string;
  cardIds?: string[];
}

/**
 * Rewards analytics data
 */
export interface RewardsAnalytics {
  totalEarned: {
    cashback: number;
    points: number;
    miles: number;
    totalValueINR: number;
  };
  totalRedeemed: {
    cashback: number;
    points: number;
    miles: number;
    totalValueINR: number;
  };
  pendingRedemption: {
    cashback: number;
    points: number;
    miles: number;
    totalValueINR: number;
  };
  monthlyTrends: {
    month: string;
    earned: number;
    redeemed: number;
    netValue: number;
  }[];
  categoryBreakdown: {
    category: string;
    earned: number;
    transactions: number;
    averageRate: number;
  }[];
  cardPerformance: {
    cardId: string;
    cardName: string;
    totalEarned: number;
    annualFee: number;
    netBenefit: number;
    effectiveRate: number;
  }[];
  expiringRewards: {
    amount: number;
    expirationDate: string;
    cardName: string;
  }[];
}

/**
 * Comprehensive Rewards Optimization Service
 */
export class RewardsService {
  /**
   * Get comprehensive rewards analytics for a user
   */
  static async getRewardsAnalytics(
    userId: string,
    months: number = 12
  ): Promise<RewardsAnalytics> {
    try {
      const startDate = subMonths(new Date(), months);

      // Get all earned rewards in the period
      const { data: earnedRewards, error: earnedError } = await supabase
        .from("earned_rewards")
        .select("*")
        .eq("user_id", userId)
        .gte("earned_date", startDate.toISOString());

      if (earnedError) throw earnedError;

      // Get all redemptions in the period
      const { data: redemptions, error: redemptionsError } = await supabase
        .from("reward_redemptions")
        .select("*")
        .eq("user_id", userId)
        .gte("redeemed_at", startDate.toISOString());

      if (redemptionsError) throw redemptionsError;

      // Get user's cards for performance analysis
      const { data: cards, error: cardsError } = await supabase
        .from("cards")
        .select("*, reward_programs(*)")
        .eq("user_id", userId);

      if (cardsError) throw cardsError;

      return this.calculateRewardsAnalytics(
        earnedRewards || [],
        redemptions || [],
        cards || []
      );
    } catch (error) {
      console.error("Error getting rewards analytics:", error);
      throw error;
    }
  }

  /**
   * Get personalized reward optimization recommendations
   */
  static async getOptimizationRecommendations(
    userId: string
  ): Promise<RewardOptimizationTip[]> {
    try {
      // Get user's spending patterns
      const spendingPatterns = await this.analyzeSpendingPatterns(userId);

      // Get current card portfolio
      const cardPortfolio = await this.getUserCardPortfolio(userId);

      // Get available cards in market (from a hypothetical cards database)
      const marketCards = await this.getMarketCards();

      const recommendations: RewardOptimizationTip[] = [];

      // Analyze card portfolio gaps
      recommendations.push(
        ...this.analyzeCardPortfolioGaps(spendingPatterns, cardPortfolio)
      );

      // Analyze category optimization opportunities
      recommendations.push(
        ...this.analyzeCategoryOptimization(spendingPatterns, cardPortfolio)
      );

      // Analyze redemption strategies
      recommendations.push(
        ...this.analyzeRedemptionStrategies(userId, cardPortfolio)
      );

      // Analyze timing optimization
      recommendations.push(
        ...this.analyzeTimingOptimization(userId, cardPortfolio)
      );

      // Sort by potential benefit and return top recommendations
      return recommendations
        .sort((a, b) => b.potentialBenefit - a.potentialBenefit)
        .slice(0, 10);
    } catch (error) {
      console.error("Error getting optimization recommendations:", error);
      throw error;
    }
  }

  /**
   * Calculate optimal card for a specific purchase
   */
  static async getOptimalCard(
    userId: string,
    amount: number,
    category: string,
    merchantName?: string
  ): Promise<{
    recommendedCard: any;
    expectedReward: number;
    rewardRate: number;
    alternatives: Array<{
      card: any;
      expectedReward: number;
      rewardRate: number;
    }>;
  }> {
    try {
      const { data: cards, error } = await supabase
        .from("cards")
        .select("*, reward_programs(*)")
        .eq("user_id", userId)
        .eq("status", "active");

      if (error) throw error;

      if (!cards?.length) {
        throw new Error("No active cards found");
      }

      // Calculate reward for each card
      const cardRewards = cards.map((card) => {
        const reward = this.calculateRewardForTransaction(
          card,
          amount,
          category,
          merchantName
        );
        return {
          card,
          expectedReward: reward.amount,
          rewardRate: reward.rate,
        };
      });

      // Sort by expected reward
      cardRewards.sort((a, b) => b.expectedReward - a.expectedReward);

      return {
        recommendedCard: cardRewards[0].card,
        expectedReward: cardRewards[0].expectedReward,
        rewardRate: cardRewards[0].rewardRate,
        alternatives: cardRewards.slice(1, 4), // Top 3 alternatives
      };
    } catch (error) {
      console.error("Error getting optimal card:", error);
      throw error;
    }
  }

  /**
   * Track reward earning for a transaction
   */
  static async recordRewardEarning(
    userId: string,
    cardId: string,
    transactionId: string,
    amount: number,
    category: string
  ): Promise<EarnedReward | null> {
    try {
      // Get card's reward program
      const { data: card, error } = await supabase
        .from("cards")
        .select("*, reward_programs(*)")
        .eq("id", cardId)
        .eq("user_id", userId)
        .single();

      if (error || !card) return null;

      // Calculate reward
      const reward = this.calculateRewardForTransaction(
        card,
        Math.abs(amount),
        category
      );

      if (reward.amount <= 0) return null;

      // Record the earned reward
      const earnedReward: Omit<EarnedReward, "id"> = {
        userId,
        cardId,
        transactionId,
        rewardType: card.reward_programs[0]?.type || "cashback",
        amount: reward.amount,
        category,
        earnedDate: new Date().toISOString(),
        status: "active",
      };

      const { data, error: insertError } = await supabase
        .from("earned_rewards")
        .insert([earnedReward])
        .select()
        .single();

      if (insertError) throw insertError;

      return data;
    } catch (error) {
      console.error("Error recording reward earning:", error);
      throw error;
    }
  }

  /**
   * Get reward redemption options for a user
   */
  static async getRedemptionOptions(userId: string): Promise<{
    available: { [cardId: string]: any };
    recommendations: Array<{
      cardId: string;
      option: string;
      value: number;
      minimumRequired: number;
      availableBalance: number;
      canRedeem: boolean;
    }>;
  }> {
    try {
      const { data: cards, error } = await supabase
        .from("cards")
        .select("*, reward_programs(*)")
        .eq("user_id", userId);

      if (error) throw error;

      // Get current reward balances
      const balances = await this.getRewardBalances(userId);

      const available: { [cardId: string]: any } = {};
      const recommendations: any[] = [];

      cards?.forEach((card) => {
        const cardBalance = balances[card.id] || {
          amount: 0,
          type: "cashback",
        };
        const rewardProgram = card.reward_programs[0];

        if (rewardProgram?.redemptionOptions) {
          available[card.id] = {
            card,
            balance: cardBalance,
            options: rewardProgram.redemptionOptions,
          };

          // Add recommendations for each viable option
          rewardProgram.redemptionOptions.forEach((option: any) => {
            const canRedeem =
              cardBalance.amount >= (option.minimumRedemption || 0);
            recommendations.push({
              cardId: card.id,
              cardName: card.card_name,
              option: option.type,
              value: option.value * cardBalance.amount,
              minimumRequired: option.minimumRedemption || 0,
              availableBalance: cardBalance.amount,
              canRedeem,
            });
          });
        }
      });

      // Sort recommendations by value
      recommendations.sort((a, b) => b.value - a.value);

      return { available, recommendations };
    } catch (error) {
      console.error("Error getting redemption options:", error);
      throw error;
    }
  }

  /**
   * Process a reward redemption
   */
  static async processRedemption(
    userId: string,
    cardId: string,
    amount: number,
    redemptionMethod: string,
    description: string
  ): Promise<RewardRedemption> {
    try {
      // Verify user has sufficient balance
      const balances = await this.getRewardBalances(userId);
      const cardBalance = balances[cardId];

      if (!cardBalance || cardBalance.amount < amount) {
        throw new Error("Insufficient reward balance");
      }

      // Get card details for redemption value calculation
      const { data: card, error } = await supabase
        .from("cards")
        .select("*, reward_programs(*)")
        .eq("id", cardId)
        .eq("user_id", userId)
        .single();

      if (error) throw error;

      // Calculate redemption value
      const rewardProgram = card.reward_programs[0];
      const redemptionOption = rewardProgram?.redemptionOptions?.find(
        (opt: any) => opt.type === redemptionMethod
      );
      const redemptionValue = redemptionOption
        ? redemptionOption.value * amount
        : amount;

      // Create redemption record
      const redemption: Omit<RewardRedemption, "id"> = {
        userId,
        cardId,
        rewardType: cardBalance.type as "cashback" | "points" | "miles",
        amountRedeemed: amount,
        redemptionValue,
        redemptionMethod,
        redeemedAt: new Date().toISOString(),
        description,
      };

      const { data, error: insertError } = await supabase
        .from("reward_redemptions")
        .insert([redemption])
        .select()
        .single();

      if (insertError) throw insertError;

      // Update earned rewards status
      await supabase
        .from("earned_rewards")
        .update({ status: "redeemed", redemptionId: data.id })
        .eq("user_id", userId)
        .eq("card_id", cardId)
        .eq("status", "active")
        .limit(Math.floor(amount)); // Simplified - would need more complex logic for partial redemptions

      return data;
    } catch (error) {
      console.error("Error processing redemption:", error);
      throw error;
    }
  }

  /**
   * Get user's current reward balances
   */
  static async getRewardBalances(
    userId: string
  ): Promise<{ [cardId: string]: { amount: number; type: string } }> {
    try {
      const { data: rewards, error } = await supabase
        .from("earned_rewards")
        .select("card_id, reward_type, amount")
        .eq("user_id", userId)
        .eq("status", "active");

      if (error) throw error;

      const balances: { [cardId: string]: { amount: number; type: string } } =
        {};

      rewards?.forEach((reward) => {
        if (!balances[reward.card_id]) {
          balances[reward.card_id] = { amount: 0, type: reward.reward_type };
        }
        balances[reward.card_id].amount += reward.amount;
      });

      return balances;
    } catch (error) {
      console.error("Error getting reward balances:", error);
      return {};
    }
  }

  /**
   * Private: Calculate rewards for a specific transaction
   */
  private static calculateRewardForTransaction(
    card: any,
    amount: number,
    category: string,
    merchantName?: string
  ): { amount: number; rate: number } {
    const rewardProgram = card.reward_programs?.[0];

    if (!rewardProgram) {
      return { amount: 0, rate: 0 };
    }

    let rewardRate = rewardProgram.baseRate || 0;

    // Check for category-specific rates
    if (rewardProgram.categoryRates && rewardProgram.categoryRates[category]) {
      rewardRate = rewardProgram.categoryRates[category];
    }

    // Check for bonus categories
    if (
      rewardProgram.bonusCategories &&
      rewardProgram.bonusCategories.includes(category)
    ) {
      rewardRate = Math.max(rewardRate, rewardProgram.baseRate * 2); // 2x bonus example
    }

    // Calculate reward amount based on type
    let rewardAmount: number;

    switch (rewardProgram.type) {
      case "cashback":
        rewardAmount = (amount * rewardRate) / 100;
        break;
      case "points":
        rewardAmount = amount * (rewardRate / 100); // Points per rupee
        break;
      case "miles":
        rewardAmount = amount * (rewardRate / 100); // Miles per rupee
        break;
      default:
        rewardAmount = (amount * rewardRate) / 100;
    }

    return {
      amount: Math.round(rewardAmount * 100) / 100, // Round to 2 decimals
      rate: rewardRate,
    };
  }

  /**
   * Private: Analyze user's spending patterns
   */
  private static async analyzeSpendingPatterns(userId: string) {
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("category, amount, merchant_name")
      .eq("user_id", userId)
      .gte("transaction_date", subMonths(new Date(), 6).toISOString())
      .lt("amount", 0); // Only debits

    if (error) return {};

    const patterns: {
      [category: string]: { total: number; count: number; avgAmount: number };
    } = {};

    transactions?.forEach((txn) => {
      const category = txn.category || "Other";
      const amount = Math.abs(txn.amount);

      if (!patterns[category]) {
        patterns[category] = { total: 0, count: 0, avgAmount: 0 };
      }

      patterns[category].total += amount;
      patterns[category].count += 1;
      patterns[category].avgAmount =
        patterns[category].total / patterns[category].count;
    });

    return patterns;
  }

  /**
   * Private: Get user's current card portfolio
   */
  private static async getUserCardPortfolio(userId: string) {
    const { data: cards, error } = await supabase
      .from("cards")
      .select("*, reward_programs(*)")
      .eq("user_id", userId)
      .eq("status", "active");

    return cards || [];
  }

  /**
   * Private: Get available cards in market (mock implementation)
   */
  private static async getMarketCards() {
    // This would typically fetch from a cards database
    // For now, return mock data
    return [
      {
        name: "HDFC Regalia",
        type: "premium",
        baseRewardRate: 2.0,
        bonusCategories: ["dining", "travel"],
        annualFee: 2500,
      },
      {
        name: "SBI SimplyCLICK",
        type: "online",
        baseRewardRate: 1.0,
        bonusCategories: ["online", "utilities"],
        annualFee: 499,
      },
    ];
  }

  /**
   * Private: Analyze card portfolio gaps
   */
  private static analyzeCardPortfolioGaps(
    spendingPatterns: any,
    cardPortfolio: any[]
  ): RewardOptimizationTip[] {
    const tips: RewardOptimizationTip[] = [];

    // Check for high-spend categories without optimal cards
    Object.entries(spendingPatterns).forEach(
      ([category, data]: [string, any]) => {
        if (data.total > 10000) {
          // High spend category (>10k in 6 months)
          const hasOptimalCard = cardPortfolio.some((card) => {
            const program = card.reward_programs?.[0];
            return (
              program?.bonusCategories?.includes(category) ||
              (program?.categoryRates &&
                program.categoryRates[category] > program.baseRate)
            );
          });

          if (!hasOptimalCard) {
            tips.push({
              id: `gap_${category}`,
              type: "card_recommendation",
              title: `Missing optimal card for ${category}`,
              description: `You spend ₹${data.total.toLocaleString()} on ${category} but don't have a card optimized for this category.`,
              potentialBenefit: data.total * 0.02, // Estimate 2% additional reward
              confidence: 80,
              actionRequired: `Consider getting a card with bonus rewards for ${category}`,
              priority: data.total > 50000 ? "high" : "medium",
              category,
            });
          }
        }
      }
    );

    return tips;
  }

  /**
   * Private: Analyze category optimization opportunities
   */
  private static analyzeCategoryOptimization(
    spendingPatterns: any,
    cardPortfolio: any[]
  ): RewardOptimizationTip[] {
    const tips: RewardOptimizationTip[] = [];

    // Analyze if user is using suboptimal cards for specific categories
    Object.entries(spendingPatterns).forEach(
      ([category, data]: [string, any]) => {
        if (data.total > 5000) {
          const bestCard = cardPortfolio.reduce((best, card) => {
            const program = card.reward_programs?.[0];
            const rate =
              program?.categoryRates?.[category] || program?.baseRate || 0;
            const bestRate =
              best?.reward_programs?.[0]?.categoryRates?.[category] ||
              best?.reward_programs?.[0]?.baseRate ||
              0;
            return rate > bestRate ? card : best;
          }, null);

          if (bestCard) {
            const currentRate =
              bestCard.reward_programs[0]?.categoryRates?.[category] ||
              bestCard.reward_programs[0]?.baseRate ||
              0;
            const potentialIncrease = data.total * (currentRate * 0.01); // 1% additional as example

            if (potentialIncrease > 500) {
              // Only suggest if benefit > ₹500
              tips.push({
                id: `optimize_${category}`,
                type: "category_optimization",
                title: `Optimize ${category} spending`,
                description: `Use ${bestCard.card_name} for ${category} purchases to maximize rewards.`,
                potentialBenefit: potentialIncrease,
                confidence: 90,
                actionRequired: `Switch to using ${bestCard.card_name} for ${category} purchases`,
                priority: potentialIncrease > 2000 ? "high" : "medium",
                category,
                cardIds: [bestCard.id],
              });
            }
          }
        }
      }
    );

    return tips;
  }

  /**
   * Private: Analyze redemption strategies
   */
  private static analyzeRedemptionStrategies(
    userId: string,
    cardPortfolio: any[]
  ): RewardOptimizationTip[] {
    // This would analyze current reward balances and suggest optimal redemption timing
    // Simplified implementation
    return [
      {
        id: "redemption_timing",
        type: "redemption_strategy",
        title: "Optimize reward redemption timing",
        description:
          "Consider redeeming rewards before they expire or when better redemption options become available.",
        potentialBenefit: 1000,
        confidence: 70,
        actionRequired: "Review current reward balances and expiration dates",
        priority: "medium",
      },
    ];
  }

  /**
   * Private: Analyze timing optimization
   */
  private static analyzeTimingOptimization(
    userId: string,
    cardPortfolio: any[]
  ): RewardOptimizationTip[] {
    // This would analyze spending timing vs bonus periods, quarterly caps, etc.
    // Simplified implementation
    return [
      {
        id: "timing_quarterly",
        type: "timing_optimization",
        title: "Maximize quarterly bonus categories",
        description:
          "Plan major purchases around quarterly bonus categories to maximize rewards.",
        potentialBenefit: 2000,
        confidence: 85,
        actionRequired:
          "Check quarterly bonus categories and plan upcoming purchases",
        priority: "medium",
      },
    ];
  }

  /**
   * Private: Calculate comprehensive rewards analytics
   */
  private static calculateRewardsAnalytics(
    earnedRewards: any[],
    redemptions: any[],
    cards: any[]
  ): RewardsAnalytics {
    // Aggregate earned rewards
    const totalEarned = earnedRewards.reduce(
      (acc, reward) => {
        acc[reward.reward_type] =
          (acc[reward.reward_type] || 0) + reward.amount;
        return acc;
      },
      { cashback: 0, points: 0, miles: 0 }
    );

    // Aggregate redemptions
    const totalRedeemed = redemptions.reduce(
      (acc, redemption) => {
        acc[redemption.reward_type] =
          (acc[redemption.reward_type] || 0) + redemption.amount_redeemed;
        return acc;
      },
      { cashback: 0, points: 0, miles: 0 }
    );

    // Calculate pending (earned but not redeemed)
    const pendingRedemption = {
      cashback: totalEarned.cashback - totalRedeemed.cashback,
      points: totalEarned.points - totalRedeemed.points,
      miles: totalEarned.miles - totalRedeemed.miles,
    };

    // Calculate total values (simplified - assumes 1:1 for cashback, 0.25:1 for points/miles)
    const earnedValueINR =
      totalEarned.cashback +
      totalEarned.points * 0.25 +
      totalEarned.miles * 0.25;
    const redeemedValueINR =
      totalRedeemed.cashback +
      totalRedeemed.points * 0.25 +
      totalRedeemed.miles * 0.25;
    const pendingValueINR =
      pendingRedemption.cashback +
      pendingRedemption.points * 0.25 +
      pendingRedemption.miles * 0.25;

    return {
      totalEarned: {
        ...totalEarned,
        totalValueINR: earnedValueINR,
      },
      totalRedeemed: {
        ...totalRedeemed,
        totalValueINR: redeemedValueINR,
      },
      pendingRedemption: {
        ...pendingRedemption,
        totalValueINR: pendingValueINR,
      },
      monthlyTrends: [], // Would implement with date grouping
      categoryBreakdown: [], // Would implement with category analysis
      cardPerformance: [], // Would implement with card-wise analysis
      expiringRewards: [], // Would implement with expiration analysis
    };
  }

  /**
   * CRUD Wrapper Methods for API Controller
   */
  async trackReward(data: any): Promise<any> {
    const { data: reward } = await supabase.from("rewards").insert(data).select().single(); return reward;
  }

  async getReward(id: string): Promise<any> {
    const { data } = await supabase
      .from('rewards')
      .select('*')
      .eq('id', id)
      .single();
    return data;
  }

  async getUserRewards(userId: string): Promise<any> {
    const { data } = await supabase.from("rewards").select("*").eq("user_id", userId).order("earned_date", { ascending: false }); return data || [];
  }

  async updateReward(id: string, data: any): Promise<any> {
    const { data: updated } = await supabase
      .from('rewards')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    return updated;
  }

  async deleteReward(id: string): Promise<void> {
    await supabase.from('rewards').delete().eq('id', id);
  }

}


// Export singleton instance
export const rewardsService = new RewardsService();
