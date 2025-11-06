import { Router, Response } from "express";
import { authenticate, AuthRequest } from '@common/middleware/auth';
import { SubscriptionService } from "../services/subscription.service";

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Get all detected subscriptions for user
 * GET /subscriptions
 */
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const subscriptions =
      await SubscriptionService.getUserSubscriptions(userId);

    res.json({
      success: true,
      data: subscriptions,
    });
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch subscriptions",
    });
  }
});

/**
 * Run subscription detection for user
 * POST /subscriptions/detect
 */
router.post("/detect", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const detectedSubscriptions =
      await SubscriptionService.detectSubscriptions(userId);

    res.json({
      success: true,
      data: {
        detected: detectedSubscriptions,
        count: detectedSubscriptions.length,
      },
    });
  } catch (error) {
    console.error("Error detecting subscriptions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to detect subscriptions",
    });
  }
});

/**
 * Get subscription insights and analytics
 * GET /subscriptions/insights
 */
router.get("/insights", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const insights = await SubscriptionService.getSubscriptionInsights(userId);

    res.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    console.error("Error fetching subscription insights:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch subscription insights",
    });
  }
});

/**
 * Get upcoming subscription renewals
 * GET /subscriptions/upcoming?days=7
 */
router.get("/upcoming", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const days = parseInt(req.query.days as string) || 7;

    const upcomingRenewals = await SubscriptionService.getUpcomingRenewals(
      userId,
      days
    );

    res.json({
      success: true,
      data: upcomingRenewals,
    });
  } catch (error) {
    console.error("Error fetching upcoming renewals:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch upcoming renewals",
    });
  }
});

/**
 * Update subscription status
 * PUT /subscriptions/:id/status
 */
router.put("/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const subscriptionId = req.params.id;
    const { status } = req.body;

    // Validate status
    const validStatuses = [
      "active",
      "inactive",
      "cancelled",
      "pending_confirmation",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status. Must be one of: " + validStatuses.join(", "),
      });
    }

    await SubscriptionService.updateSubscriptionStatus(
      subscriptionId,
      userId,
      status
    );

    res.json({
      success: true,
      message: "Subscription status updated successfully",
    });
  } catch (error) {
    console.error("Error updating subscription status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update subscription status",
    });
  }
});

/**
 * Cancel a subscription
 * DELETE /subscriptions/:id
 */
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const subscriptionId = req.params.id;

    await SubscriptionService.cancelSubscription(subscriptionId, userId);

    res.json({
      success: true,
      message: "Subscription cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cancel subscription",
    });
  }
});

/**
 * Manually add a subscription
 * POST /subscriptions/manual
 */
router.post("/manual", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { merchantName, amount, frequency, category, billingCycleDay } =
      req.body;

    // Validate required fields
    if (!merchantName || !amount || !frequency || !category) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: merchantName, amount, frequency, category",
      });
    }

    // Validate frequency
    const validFrequencies = ["weekly", "monthly", "quarterly", "annually"];
    if (!validFrequencies.includes(frequency)) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid frequency. Must be one of: " + validFrequencies.join(", "),
      });
    }

    // Validate amount
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Amount must be a positive number",
      });
    }

    const subscription = await SubscriptionService.addManualSubscription(
      userId,
      {
        merchantName,
        amount,
        frequency,
        category,
        billingCycleDay: billingCycleDay
          ? parseInt(billingCycleDay)
          : undefined,
      }
    );

    res.status(201).json({
      success: true,
      data: subscription,
      message: "Subscription added successfully",
    });
  } catch (error) {
    console.error("Error adding manual subscription:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add subscription",
    });
  }
});

/**
 * Get subscription by category
 * GET /subscriptions/category/:category
 */
router.get("/category/:category", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const category = req.params.category;

    const allSubscriptions =
      await SubscriptionService.getUserSubscriptions(userId);
    const categorySubscriptions = allSubscriptions.filter(
      (sub) => sub.category.toLowerCase() === category.toLowerCase()
    );

    res.json({
      success: true,
      data: categorySubscriptions,
    });
  } catch (error) {
    console.error("Error fetching category subscriptions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch category subscriptions",
    });
  }
});

/**
 * Get subscription summary stats
 * GET /subscriptions/summary
 */
router.get("/summary", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const subscriptions =
      await SubscriptionService.getUserSubscriptions(userId);

    // Calculate monthly amounts for active subscriptions
    const monthlyAmounts = subscriptions
      .filter((sub) => sub.status === "active")
      .map((sub) => {
        switch (sub.frequency) {
          case "weekly":
            return sub.amount * 4.33; // Average weeks per month
          case "monthly":
            return sub.amount;
          case "quarterly":
            return sub.amount / 3;
          case "annually":
            return sub.amount / 12;
          default:
            return sub.amount;
        }
      });

    const summary = {
      total: subscriptions.length,
      active: subscriptions.filter((sub) => sub.status === "active").length,
      inactive: subscriptions.filter((sub) => sub.status === "inactive").length,
      pending: subscriptions.filter(
        (sub) => sub.status === "pending_confirmation"
      ).length,
      cancelled: subscriptions.filter((sub) => sub.status === "cancelled")
        .length,
      totalMonthlySpend: monthlyAmounts.reduce(
        (sum, amount) => sum + amount,
        0
      ),
      categories: [...new Set(subscriptions.map((sub) => sub.category))],
      averageConfidence:
        subscriptions.length > 0
          ? subscriptions.reduce((sum, sub) => sum + sub.confidence_score, 0) /
            subscriptions.length
          : 0,
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching subscription summary:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch subscription summary",
    });
  }
});

/**
 * Confirm a pending subscription
 * POST /subscriptions/:id/confirm
 */
router.post("/:id/confirm", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const subscriptionId = req.params.id;

    await SubscriptionService.updateSubscriptionStatus(
      subscriptionId,
      userId,
      "active"
    );

    res.json({
      success: true,
      message: "Subscription confirmed and activated",
    });
  } catch (error) {
    console.error("Error confirming subscription:", error);
    res.status(500).json({
      success: false,
      error: "Failed to confirm subscription",
    });
  }
});

/**
 * Reject a pending subscription
 * POST /subscriptions/:id/reject
 */
router.post("/:id/reject", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const subscriptionId = req.params.id;

    await SubscriptionService.updateSubscriptionStatus(
      subscriptionId,
      userId,
      "inactive"
    );

    res.json({
      success: true,
      message: "Subscription rejected",
    });
  } catch (error) {
    console.error("Error rejecting subscription:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reject subscription",
    });
  }
});

/**
 * Update subscription details
 * PUT /subscriptions/:id
 */
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const subscriptionId = req.params.id;
    const updates = req.body;

    // TODO: Implement subscription update functionality
    // This would involve updating fields like amount, frequency, category, etc.

    res.status(501).json({
      success: false,
      error: "Subscription update functionality not yet implemented",
    });
  } catch (error) {
    console.error("Error updating subscription:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update subscription",
    });
  }
});

export default router;
