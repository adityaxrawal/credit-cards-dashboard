import { Router, Request, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { BudgetService } from "../services/budget.service";
import {
  EnhancedBudgetService,
  PeriodType,
} from "../services/budget-enhanced.service";

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /budget/current
 * Get current month budget status with detailed breakdown
 */
router.get("/current", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const budgetData = await BudgetService.getCurrentBudget(userId);

    res.json({
      success: true,
      data: budgetData,
    });
  } catch (error) {
    console.error("Error fetching current budget:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch budget";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * PUT /budget
 * Update budget limit for current or next month
 */
router.put("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { budgetLimit, effectiveFrom = "next_month" } = req.body;

    // Validation
    if (!budgetLimit || typeof budgetLimit !== "number" || budgetLimit <= 0) {
      return res.status(400).json({
        success: false,
        error: "Valid budget limit is required",
      });
    }

    if (!["current_month", "next_month"].includes(effectiveFrom)) {
      return res.status(400).json({
        success: false,
        error: "effectiveFrom must be 'current_month' or 'next_month'",
      });
    }

    const result = await BudgetService.updateBudgetLimit(
      userId,
      budgetLimit,
      effectiveFrom
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error updating budget:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update budget";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /budget/history
 * Get budget history for multiple months
 */
router.get("/history", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const months = req.query.months ? parseInt(req.query.months as string) : 12;

    // Validation
    if (months < 1 || months > 24) {
      return res.status(400).json({
        success: false,
        error: "Months must be between 1 and 24",
      });
    }

    const history = await BudgetService.getBudgetHistory(userId, months);

    res.json({
      success: true,
      data: { history },
    });
  } catch (error) {
    console.error("Error fetching budget history:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch budget history";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /budget/forecast
 * Get spending forecast for upcoming months
 */
router.post("/forecast", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { months = 3 } = req.body;

    // Validation
    if (months < 1 || months > 12) {
      return res.status(400).json({
        success: false,
        error: "Months must be between 1 and 12",
      });
    }

    const forecasts = await BudgetService.forecastSpending(userId, months);

    res.json({
      success: true,
      data: { forecasts },
    });
  } catch (error) {
    console.error("Error generating forecast:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate forecast";

    if (message.includes("Insufficient historical data")) {
      return res.status(400).json({
        success: false,
        error: message,
      });
    }

    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /budget/simulate
 * Simulate different budget scenarios
 */
router.post("/simulate", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { scenarios } = req.body;

    // Validation
    if (!Array.isArray(scenarios) || scenarios.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Scenarios array is required",
      });
    }

    if (scenarios.length > 5) {
      return res.status(400).json({
        success: false,
        error: "Maximum 5 scenarios allowed",
      });
    }

    // Validate each scenario
    for (const scenario of scenarios) {
      if (
        !scenario.budgetLimit ||
        typeof scenario.budgetLimit !== "number" ||
        scenario.budgetLimit <= 0
      ) {
        return res.status(400).json({
          success: false,
          error: "Each scenario must have a valid budgetLimit",
        });
      }
    }

    const simulations = await BudgetService.simulateBudget(userId, scenarios);

    res.json({
      success: true,
      data: { simulations },
    });
  } catch (error) {
    console.error("Error simulating budget:", error);
    const message =
      error instanceof Error ? error.message : "Failed to simulate budget";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /budget/alerts
 * Get budget alert history and settings
 */
router.get("/alerts", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Get recent budget-related alerts
    const { data: alertData, error: alertError } = await (req as any).supabase
      .from("alerts")
      .select("*")
      .eq("user_id", userId)
      .in("alert_type", ["budget_threshold", "budget_exceeded"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (alertError) throw alertError;

    // Default alert settings (in a real app, this would be stored in user preferences)
    const defaultSettings = {
      enabled: true,
      thresholds: [70, 90, 100],
      channels: ["email", "in_app"],
      frequency: "immediate",
      quietHours: {
        enabled: false,
        start: "22:00",
        end: "08:00",
      },
    };

    const alerts = (alertData || []).map((alert: any) => ({
      id: alert.id,
      type: alert.alert_type,
      threshold: alert.metadata?.threshold || null,
      triggeredAt: alert.created_at,
      spentAtTrigger: alert.metadata?.spent || null,
      budgetAtTrigger: alert.metadata?.budget || null,
      message: alert.message,
      acknowledged: alert.is_read,
      acknowledgedAt: alert.read_at,
    }));

    res.json({
      success: true,
      data: {
        alerts,
        settings: defaultSettings,
      },
    });
  } catch (error) {
    console.error("Error fetching budget alerts:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch budget alerts";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * PUT /budget/alerts/settings
 * Update budget alert preferences
 */
router.put("/alerts/settings", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { enabled, thresholds, channels, frequency, quietHours } = req.body;

    // Validation
    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "enabled must be a boolean",
      });
    }

    if (
      thresholds &&
      (!Array.isArray(thresholds) ||
        !thresholds.every((t) => typeof t === "number" && t > 0 && t <= 100))
    ) {
      return res.status(400).json({
        success: false,
        error: "thresholds must be an array of numbers between 0 and 100",
      });
    }

    if (
      channels &&
      (!Array.isArray(channels) ||
        !channels.every((c) => ["email", "in_app", "sms", "push"].includes(c)))
    ) {
      return res.status(400).json({
        success: false,
        error: "channels must be an array containing valid channel types",
      });
    }

    if (
      frequency &&
      !["immediate", "daily_digest", "weekly_digest"].includes(frequency)
    ) {
      return res.status(400).json({
        success: false,
        error:
          "frequency must be 'immediate', 'daily_digest', or 'weekly_digest'",
      });
    }

    // In a real application, you would save these settings to a user_preferences table
    // For now, we'll just return the validated settings
    const updatedSettings = {
      enabled,
      thresholds: thresholds || [70, 90, 100],
      channels: channels || ["email", "in_app"],
      frequency: frequency || "immediate",
      quietHours: quietHours || {
        enabled: false,
        start: "22:00",
        end: "08:00",
      },
    };

    res.json({
      success: true,
      data: { settings: updatedSettings },
    });
  } catch (error) {
    console.error("Error updating alert settings:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update alert settings";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /budget/categories
 * Create a category-level budget
 */
router.post("/categories", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { categoryName, budgetLimit, periodType, startDate } = req.body;

    // Validation
    if (!categoryName || typeof categoryName !== "string") {
      return res.status(400).json({
        success: false,
        error: "Valid category name is required",
      });
    }

    if (!budgetLimit || typeof budgetLimit !== "number" || budgetLimit <= 0) {
      return res.status(400).json({
        success: false,
        error: "Valid budget limit is required",
      });
    }

    if (
      periodType &&
      !["monthly", "quarterly", "annual"].includes(periodType)
    ) {
      return res.status(400).json({
        success: false,
        error: "Period type must be monthly, quarterly, or annual",
      });
    }

    const category = await EnhancedBudgetService.createCategoryBudget(
      userId,
      categoryName,
      budgetLimit,
      (periodType as PeriodType) || "monthly",
      startDate ? new Date(startDate) : undefined,
      { ip_address: req.ip, user_agent: req.get("user-agent") }
    );

    res.status(201).json({
      success: true,
      data: { category },
    });
  } catch (error) {
    console.error("Error creating category budget:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create category budget";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /budget/categories
 * Get all category budgets
 */
router.get("/categories", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const periodType = req.query.periodType as PeriodType | undefined;

    const categories = await EnhancedBudgetService.getCategoryBudgets(
      userId,
      periodType
    );

    // Get current spending for each category
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const categorySpending = await EnhancedBudgetService.getCategorySpending(
      userId,
      startOfMonth,
      endOfMonth
    );

    res.json({
      success: true,
      data: {
        categories,
        spending: categorySpending,
      },
    });
  } catch (error) {
    console.error("Error fetching category budgets:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch category budgets";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * PUT /budget/categories/:categoryId
 * Update category budget
 */
router.put(
  "/categories/:categoryId",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { categoryId } = req.params;
      const updates = req.body;

      const category = await EnhancedBudgetService.updateCategoryBudget(
        userId,
        categoryId,
        updates,
        { ip_address: req.ip, user_agent: req.get("user-agent") }
      );

      res.json({
        success: true,
        data: { category },
      });
    } catch (error) {
      console.error("Error updating category budget:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update category budget";
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  }
);

/**
 * POST /budget/cards
 * Set budget for a specific card
 */
router.post("/cards", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { cardId, month, year, budgetLimit } = req.body;

    // Validation
    if (!cardId) {
      return res.status(400).json({
        success: false,
        error: "Card ID is required",
      });
    }

    if (!month || month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        error: "Valid month (1-12) is required",
      });
    }

    if (!year || year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        error: "Valid year is required",
      });
    }

    if (!budgetLimit || budgetLimit <= 0) {
      return res.status(400).json({
        success: false,
        error: "Valid budget limit is required",
      });
    }

    const cardBudget = await EnhancedBudgetService.setCardBudget(
      userId,
      cardId,
      month,
      year,
      budgetLimit,
      { ip_address: req.ip, user_agent: req.get("user-agent") }
    );

    res.json({
      success: true,
      data: { cardBudget },
    });
  } catch (error) {
    console.error("Error setting card budget:", error);
    const message =
      error instanceof Error ? error.message : "Failed to set card budget";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /budget/cards
 * Get card budgets for a specific month
 */
router.get("/cards", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const now = new Date();
    const month = req.query.month
      ? parseInt(req.query.month as string)
      : now.getMonth() + 1;
    const year = req.query.year
      ? parseInt(req.query.year as string)
      : now.getFullYear();

    const cardBudgets = await EnhancedBudgetService.getCardBudgets(
      userId,
      month,
      year
    );

    res.json({
      success: true,
      data: { cardBudgets },
    });
  } catch (error) {
    console.error("Error fetching card budgets:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch card budgets";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /budget/analytics
 * Get comprehensive budget analytics
 */
router.get("/analytics", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const analytics =
      await EnhancedBudgetService.getComprehensiveBudgetAnalytics(userId);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error("Error fetching budget analytics:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch analytics";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /budget/audit-log
 * Get budget audit trail
 */
router.get("/audit-log", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const options = {
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      actionType: req.query.actionType as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };

    const result = await EnhancedBudgetService.getBudgetAuditLog(
      userId,
      options
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching audit log:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch audit log";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /budget/alert-config
 * Get budget alert configuration
 */
router.get("/alert-config", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const config = await EnhancedBudgetService.getBudgetAlertConfig(userId);

    res.json({
      success: true,
      data: { config },
    });
  } catch (error) {
    console.error("Error fetching alert config:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch alert config";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * PUT /budget/alert-config
 * Update budget alert configuration
 */
router.put("/alert-config", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const updates = req.body;

    const config = await EnhancedBudgetService.updateBudgetAlertConfig(
      userId,
      updates
    );

    res.json({
      success: true,
      data: { config },
    });
  } catch (error) {
    console.error("Error updating alert config:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update alert config";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /budget/forecasts/generate
 * Generate spending forecasts
 */
router.post("/forecasts/generate", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { days = 30 } = req.body;

    if (days < 1 || days > 90) {
      return res.status(400).json({
        success: false,
        error: "Forecast days must be between 1 and 90",
      });
    }

    const forecasts = await EnhancedBudgetService.generateSpendingForecast(
      userId,
      days
    );

    res.json({
      success: true,
      data: { forecasts },
    });
  } catch (error) {
    console.error("Error generating forecasts:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate forecasts";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

export default router;
