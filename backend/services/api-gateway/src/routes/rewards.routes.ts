import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import {
  RewardsService,
  RewardOptimizationTip,
} from "../services/rewards.service";

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Get comprehensive rewards analytics
 * GET /rewards/analytics?months=12
 */
router.get("/analytics", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const months = parseInt(req.query.months as string) || 12;

    const analytics = await RewardsService.getRewardsAnalytics(userId, months);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error("Error fetching rewards analytics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch rewards analytics",
    });
  }
});

/**
 * Get personalized optimization recommendations
 * GET /rewards/optimization
 */
router.get("/optimization", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const recommendations =
      await RewardsService.getOptimizationRecommendations(userId);

    res.json({
      success: true,
      data: {
        recommendations,
        summary: {
          totalRecommendations: recommendations.length,
          potentialAnnualBenefit: recommendations.reduce(
            (sum, rec) => sum + rec.potentialBenefit,
            0
          ),
          highPriorityCount: recommendations.filter(
            (rec) => rec.priority === "high"
          ).length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching optimization recommendations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch optimization recommendations",
    });
  }
});

/**
 * Get optimal card recommendation for a purchase
 * POST /rewards/optimal-card
 */
router.post("/optimal-card", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { amount, category, merchantName } = req.body;

    if (!amount || !category) {
      return res.status(400).json({
        success: false,
        error: "Amount and category are required",
      });
    }

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Amount must be a positive number",
      });
    }

    const recommendation = await RewardsService.getOptimalCard(
      userId,
      amount,
      category,
      merchantName
    );

    res.json({
      success: true,
      data: recommendation,
    });
  } catch (error) {
    console.error("Error getting optimal card recommendation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get optimal card recommendation",
    });
  }
});

/**
 * Get current reward balances for all cards
 * GET /rewards/balances
 */
router.get("/balances", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const balances = await RewardsService.getRewardBalances(userId);

    // Get card names for better display
    const cardIds = Object.keys(balances);
    let cardDetails = {};

    if (cardIds.length > 0) {
      const { data: cards } = await (RewardsService as any).supabase
        .from("cards")
        .select("id, card_name, card_type")
        .eq("user_id", userId)
        .in("id", cardIds);

      cardDetails = (cards || []).reduce((acc: any, card: any) => {
        acc[card.id] = card;
        return acc;
      }, {});
    }

    const balancesWithDetails = Object.entries(balances).map(
      ([cardId, balance]) => ({
        cardId,
        cardName: (cardDetails as any)[cardId]?.card_name || "Unknown Card",
        cardType: (cardDetails as any)[cardId]?.card_type || "unknown",
        ...balance,
      })
    );

    res.json({
      success: true,
      data: {
        balances: balancesWithDetails,
        totalValue: balancesWithDetails.reduce((sum, balance) => {
          // Simplified value calculation: cashback = 1:1, points/miles = 0.25:1
          const multiplier = balance.type === "cashback" ? 1 : 0.25;
          return sum + balance.amount * multiplier;
        }, 0),
      },
    });
  } catch (error) {
    console.error("Error fetching reward balances:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch reward balances",
    });
  }
});

/**
 * Get redemption options for all cards
 * GET /rewards/redemption-options
 */
router.get("/redemption-options", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const redemptionData = await RewardsService.getRedemptionOptions(userId);

    res.json({
      success: true,
      data: redemptionData,
    });
  } catch (error) {
    console.error("Error fetching redemption options:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch redemption options",
    });
  }
});

/**
 * Process a reward redemption
 * POST /rewards/redeem
 */
router.post("/redeem", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { cardId, amount, redemptionMethod, description } = req.body;

    // Validate required fields
    if (!cardId || !amount || !redemptionMethod) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: cardId, amount, redemptionMethod",
      });
    }

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Amount must be a positive number",
      });
    }

    const redemption = await RewardsService.processRedemption(
      userId,
      cardId,
      amount,
      redemptionMethod,
      description || `Reward redemption via ${redemptionMethod}`
    );

    res.status(201).json({
      success: true,
      data: redemption,
      message: "Reward redemption processed successfully",
    });
  } catch (error) {
    console.error("Error processing redemption:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to process redemption",
    });
  }
});

/**
 * Get redemption history
 * GET /rewards/redemption-history
 */
router.get("/redemption-history", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const { data: redemptions, error } = await (RewardsService as any).supabase
      .from("reward_redemptions")
      .select(
        `
        *,
        cards!inner(card_name, card_type)
      `
      )
      .eq("user_id", userId)
      .order("redeemed_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch redemption history: ${error.message}`);
    }

    res.json({
      success: true,
      data: redemptions || [],
    });
  } catch (error) {
    console.error("Error fetching redemption history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch redemption history",
    });
  }
});

/**
 * Get earned rewards history
 * GET /rewards/earned-history
 */
router.get("/earned-history", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const cardId = req.query.cardId as string;

    let query = (RewardsService as any).supabase
      .from("earned_rewards")
      .select(
        `
        *,
        cards!inner(card_name, card_type)
      `
      )
      .eq("user_id", userId)
      .order("earned_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (cardId) {
      query = query.eq("card_id", cardId);
    }

    const { data: earnedRewards, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch earned rewards: ${error.message}`);
    }

    res.json({
      success: true,
      data: earnedRewards || [],
    });
  } catch (error) {
    console.error("Error fetching earned rewards history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch earned rewards history",
    });
  }
});

/**
 * Record reward earning (used by transaction processing)
 * POST /rewards/record-earning
 */
router.post("/record-earning", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { cardId, transactionId, amount, category } = req.body;

    if (!cardId || !transactionId || !amount || !category) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: cardId, transactionId, amount, category",
      });
    }

    const earnedReward = await RewardsService.recordRewardEarning(
      userId,
      cardId,
      transactionId,
      amount,
      category
    );

    if (!earnedReward) {
      return res.json({
        success: true,
        message: "No rewards earned for this transaction",
        data: null,
      });
    }

    res.status(201).json({
      success: true,
      data: earnedReward,
      message: "Reward earning recorded successfully",
    });
  } catch (error) {
    console.error("Error recording reward earning:", error);
    res.status(500).json({
      success: false,
      error: "Failed to record reward earning",
    });
  }
});

/**
 * Get rewards summary dashboard data
 * GET /rewards/dashboard
 */
router.get("/dashboard", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Get analytics for the last 12 months
    const analytics = await RewardsService.getRewardsAnalytics(userId, 12);

    // Get current balances
    const balances = await RewardsService.getRewardBalances(userId);

    // Get optimization recommendations (top 5)
    const allRecommendations =
      await RewardsService.getOptimizationRecommendations(userId);
    const topRecommendations = allRecommendations.slice(0, 5);

    // Get redemption options
    const redemptionData = await RewardsService.getRedemptionOptions(userId);

    const dashboard = {
      summary: {
        totalEarnedValue: analytics.totalEarned.totalValueINR,
        totalRedeemedValue: analytics.totalRedeemed.totalValueINR,
        pendingRedemptionValue: analytics.pendingRedemption.totalValueINR,
        activeCards: Object.keys(balances).length,
      },
      analytics: {
        monthlyTrends: analytics.monthlyTrends,
        categoryBreakdown: analytics.categoryBreakdown,
        cardPerformance: analytics.cardPerformance,
      },
      recommendations: {
        count: topRecommendations.length,
        items: topRecommendations,
        potentialBenefit: topRecommendations.reduce(
          (sum, rec) => sum + rec.potentialBenefit,
          0
        ),
      },
      redemption: {
        availableOptions: Object.keys(redemptionData.available).length,
        bestOptions: redemptionData.recommendations.slice(0, 3),
        expiringRewards: analytics.expiringRewards,
      },
    };

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error("Error fetching rewards dashboard:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch rewards dashboard",
    });
  }
});

/**
 * Get reward program information for cards
 * GET /rewards/programs
 */
router.get("/programs", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const { data: cards, error } = await (RewardsService as any).supabase
      .from("cards")
      .select(
        `
        id,
        card_name,
        card_type,
        status,
        reward_programs (*)
      `
      )
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to fetch reward programs: ${error.message}`);
    }

    const programs = (cards || []).map((card: any) => ({
      cardId: card.id,
      cardName: card.card_name,
      cardType: card.card_type,
      status: card.status,
      rewardProgram: card.reward_programs?.[0] || null,
    }));

    res.json({
      success: true,
      data: programs,
    });
  } catch (error) {
    console.error("Error fetching reward programs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch reward programs",
    });
  }
});

/**
 * Calculate potential rewards for a hypothetical purchase
 * POST /rewards/calculate
 */
router.post("/calculate", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { purchases } = req.body; // Array of { amount, category, merchantName }

    if (!Array.isArray(purchases) || purchases.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Purchases array is required and must not be empty",
      });
    }

    const calculations = await Promise.all(
      purchases.map(async (purchase) => {
        if (!purchase.amount || !purchase.category) {
          return {
            purchase,
            error: "Amount and category are required for each purchase",
          };
        }

        try {
          const recommendation = await RewardsService.getOptimalCard(
            userId,
            purchase.amount,
            purchase.category,
            purchase.merchantName
          );

          return {
            purchase,
            recommendation: {
              optimalCard: recommendation.recommendedCard.card_name,
              expectedReward: recommendation.expectedReward,
              rewardRate: recommendation.rewardRate,
              alternatives: recommendation.alternatives.map((alt) => ({
                cardName: alt.card.card_name,
                expectedReward: alt.expectedReward,
                rewardRate: alt.rewardRate,
              })),
            },
          };
        } catch (error) {
          return {
            purchase,
            error: "Failed to calculate rewards for this purchase",
          };
        }
      })
    );

    const totalOptimalReward = calculations
      .filter((calc) => calc.recommendation)
      .reduce(
        (sum, calc) => sum + (calc.recommendation?.expectedReward || 0),
        0
      );

    res.json({
      success: true,
      data: {
        calculations,
        summary: {
          totalPurchaseAmount: purchases.reduce((sum, p) => sum + p.amount, 0),
          totalOptimalReward,
          averageRewardRate:
            (totalOptimalReward /
              purchases.reduce((sum, p) => sum + p.amount, 0)) *
            100,
        },
      },
    });
  } catch (error) {
    console.error("Error calculating rewards:", error);
    res.status(500).json({
      success: false,
      error: "Failed to calculate rewards",
    });
  }
});

export default router;
