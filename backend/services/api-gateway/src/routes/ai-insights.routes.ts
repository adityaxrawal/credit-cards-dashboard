import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { AIInsightsService } from "../services/ai-insights.service";

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /ai-insights
 * Get comprehensive AI-powered financial insights
 */
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const insights = await AIInsightsService.generateInsights(userId);

    res.json({
      success: true,
      data: {
        insights,
        total: insights.length,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching AI insights:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate insights";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /ai-insights/actionable
 * Get only actionable insights
 */
router.get("/actionable", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const insights = await AIInsightsService.getActionableInsights(userId);

    res.json({
      success: true,
      data: {
        insights,
        total: insights.length,
      },
    });
  } catch (error) {
    console.error("Error fetching actionable insights:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to get actionable insights";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /ai-insights/high-impact
 * Get high-impact insights only
 */
router.get("/high-impact", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const insights = await AIInsightsService.getHighImpactInsights(userId);

    res.json({
      success: true,
      data: {
        insights,
        total: insights.length,
      },
    });
  } catch (error) {
    console.error("Error fetching high-impact insights:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to get high-impact insights";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /ai-insights/category/:category
 * Get insights for specific category
 */
router.get("/category/:category", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { category } = req.params;

    if (!category) {
      return res.status(400).json({
        success: false,
        error: "Category is required",
      });
    }

    const insights = await AIInsightsService.getCategoryInsights(
      userId,
      category
    );

    res.json({
      success: true,
      data: {
        insights,
        category,
        total: insights.length,
      },
    });
  } catch (error) {
    console.error("Error fetching category insights:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to get category insights";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /ai-insights/summary
 * Get insights summary with counts by type and impact
 */
router.get("/summary", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const insights = await AIInsightsService.generateInsights(userId);

    // Create summary statistics
    const summary = {
      total: insights.length,
      by_type: insights.reduce(
        (acc, insight) => {
          acc[insight.type] = (acc[insight.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      by_impact: insights.reduce(
        (acc, insight) => {
          acc[insight.impact] = (acc[insight.impact] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      actionable_count: insights.filter((i) => i.actionable).length,
      average_confidence:
        insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length ||
        0,
      top_insights: insights.slice(0, 3).map((insight) => ({
        id: insight.id,
        title: insight.title,
        type: insight.type,
        impact: insight.impact,
        confidence: insight.confidence,
      })),
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching insights summary:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get insights summary";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /ai-insights/generate
 * Generate fresh insights with custom parameters
 */
router.post("/generate", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      dateRange,
      categories,
      analysisType,
      forceRefresh = false,
    } = req.body;

    // Validate input parameters
    if (dateRange && (!dateRange.start || !dateRange.end)) {
      return res.status(400).json({
        success: false,
        error: "Invalid date range. Both start and end dates are required.",
      });
    }

    if (categories && !Array.isArray(categories)) {
      return res.status(400).json({
        success: false,
        error: "Categories must be an array of strings.",
      });
    }

    const validAnalysisTypes = [
      "spending",
      "budgeting",
      "recommendations",
      "all",
    ];
    if (analysisType && !validAnalysisTypes.includes(analysisType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid analysis type. Must be one of: ${validAnalysisTypes.join(", ")}.`,
      });
    }

    // Generate insights with custom parameters
    const insights = await AIInsightsService.generateCustomInsights(userId, {
      dateRange,
      categories,
      analysisType: analysisType || "all",
      forceRefresh,
    });

    res.json({
      success: true,
      data: {
        insights,
        total: insights.length,
        parameters: {
          dateRange,
          categories,
          analysisType: analysisType || "all",
          forceRefresh,
        },
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error generating custom insights:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate custom insights";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /ai-insights/anomalies
 * Get transaction anomaly detection results
 */
router.get("/anomalies", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { severity = "all", limit = 20, dateRange } = req.query;

    // Validate parameters
    const validSeverities = ["low", "medium", "high", "critical", "all"];
    if (typeof severity === "string" && !validSeverities.includes(severity)) {
      return res.status(400).json({
        success: false,
        error: `Invalid severity level. Must be one of: ${validSeverities.join(", ")}.`,
      });
    }

    const anomalies = await AIInsightsService.detectAnomalies(userId, {
      severity: severity as string,
      limit: parseInt(limit as string) || 20,
      dateRange: dateRange ? JSON.parse(dateRange as string) : undefined,
    });

    res.json({
      success: true,
      data: {
        anomalies,
        total: anomalies.length,
        filters: {
          severity,
          limit: parseInt(limit as string) || 20,
          dateRange,
        },
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error detecting anomalies:", error);
    const message =
      error instanceof Error ? error.message : "Failed to detect anomalies";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

export default router;
