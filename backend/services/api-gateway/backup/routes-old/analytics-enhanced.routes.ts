import express, { Request, Response } from "express";
import { AdvancedAnalyticsService } from "../services/advanced-analytics.service";

const router = express.Router();

// Custom request interface for authenticated routes
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
  };
}

/**
 * @route GET /api/analytics/kpi
 * @desc Get comprehensive KPI dashboard with financial health score
 */
router.get("/kpi", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { period = "current_month" } = req.query;
    const kpiData = await AdvancedAnalyticsService.getKPIDashboard(
      userId,
      period as
        | "current_month"
        | "last_month"
        | "last_3_months"
        | "last_6_months"
        | "last_year"
    );
    res.json({
      success: true,
      data: kpiData,
    });
  } catch (error) {
    console.error("Error fetching KPI dashboard:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch KPI dashboard",
    });
  }
});

/**
 * @route GET /api/analytics/trends
 * @desc Get advanced trend analysis with forecasting
 */
router.get("/trends", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { metric = "spending", period = "monthly", limit = "12" } = req.query;

    const trendData = await AdvancedAnalyticsService.getTrendAnalysis(
      userId,
      metric as "spending" | "transactions" | "categories" | "merchants",
      period as "daily" | "weekly" | "monthly",
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: trendData,
    });
  } catch (error) {
    console.error("Error fetching trend analysis:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch trend analysis",
    });
  }
});

/**
 * @route GET /api/analytics/categories
 * @desc Get comprehensive category analytics with insights
 */
router.get("/categories", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { period = "current_month" } = req.query;
    const categoryData = await AdvancedAnalyticsService.getCategoryAnalytics(
      userId,
      period as
        | "current_month"
        | "last_3_months"
        | "last_6_months"
        | "last_year"
    );

    res.json({
      success: true,
      data: categoryData,
    });
  } catch (error) {
    console.error("Error fetching category analytics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch category analytics",
    });
  }
});

/**
 * @route GET /api/analytics/merchants
 * @desc Get merchant analytics and pattern recognition
 */
router.get("/merchants", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { period = "current_month", limit = "20" } = req.query;

    const merchantData = await AdvancedAnalyticsService.getMerchantAnalytics(
      userId,
      period as
        | "current_month"
        | "last_3_months"
        | "last_6_months"
        | "last_year",
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: merchantData,
    });
  } catch (error) {
    console.error("Error fetching merchant analytics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch merchant analytics",
    });
  }
});

/**
 * @route GET /api/analytics/comparison
 * @desc Get card comparison and optimization tools
 */
router.get("/comparison", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { period = "current_month" } = req.query;
    const comparisonData = await AdvancedAnalyticsService.getCardComparison(
      userId,
      period as
        | "current_month"
        | "last_3_months"
        | "last_6_months"
        | "last_year"
    );

    res.json({
      success: true,
      data: comparisonData,
    });
  } catch (error) {
    console.error("Error fetching card comparison:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch card comparison",
    });
  }
});

/**
 * @route GET /api/analytics/dashboard
 * @desc Get basic dashboard analytics (simplified version)
 */
router.get("/dashboard", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Combine KPI and basic analytics for dashboard
    const [kpiData, categoryData] = await Promise.all([
      AdvancedAnalyticsService.getKPIDashboard(userId, "current_month"),
      AdvancedAnalyticsService.getCategoryAnalytics(userId, "current_month"),
    ]);

    res.json({
      success: true,
      data: {
        kpis: kpiData.kpis,
        financialHealthScore: kpiData.financialHealthScore,
        topCategories: categoryData.categories.slice(0, 5),
        summary: kpiData.summary,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard analytics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard analytics",
    });
  }
});

/**
 * @route GET /api/analytics/spending-by-category
 * @desc Get spending breakdown by category (legacy support)
 */
router.get(
  "/spending-by-category",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { period = "current_month" } = req.query;
      const categoryData = await AdvancedAnalyticsService.getCategoryAnalytics(
        userId,
        period as
          | "current_month"
          | "last_3_months"
          | "last_6_months"
          | "last_year"
      );

      // Transform to legacy format
      const legacyFormat = categoryData.categories.map((cat) => ({
        category: cat.category,
        amount: cat.totalSpent,
        percentage: cat.percentage,
        transactionCount: cat.transactionCount,
      }));

      res.json({
        success: true,
        data: legacyFormat,
      });
    } catch (error) {
      console.error("Error fetching spending by category:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch spending by category",
      });
    }
  }
);

/**
 * @route GET /api/analytics/spending-trend
 * @desc Get spending trend over time (legacy support)
 */
router.get(
  "/spending-trend",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { period = "monthly", limit = "12" } = req.query;
      const trendData = await AdvancedAnalyticsService.getTrendAnalysis(
        userId,
        "spending",
        period as "daily" | "weekly" | "monthly",
        parseInt(limit as string)
      );

      // Transform to legacy format
      const legacyFormat = trendData.trends.map((trend) => ({
        period: trend.period,
        amount: trend.value,
        label: trend.label,
      }));

      res.json({
        success: true,
        data: {
          trends: legacyFormat,
          analysis: trendData.analysis,
        },
      });
    } catch (error) {
      console.error("Error fetching spending trend:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch spending trend",
      });
    }
  }
);

export default router;
