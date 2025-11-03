import { Router, Request, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import {
  AlertService,
  AlertType,
  AlertPriority,
  NotificationChannel,
} from "../services/alert.service";
import { EnhancedAlertService } from "../services/alert-enhanced.service";

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /alerts
 * Retrieve user alerts and notifications with filtering options
 */
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const options = {
      unreadOnly: req.query.unread_only === "true",
      types: req.query.types
        ? ((req.query.types as string).split(",") as AlertType[])
        : undefined,
      priority: req.query.priority as AlertPriority,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      startDate: req.query.start_date as string,
      endDate: req.query.end_date as string,
    };

    // Validation
    if (options.limit < 1 || options.limit > 100) {
      return res.status(400).json({
        success: false,
        error: "Limit must be between 1 and 100",
      });
    }

    if (options.offset < 0) {
      return res.status(400).json({
        success: false,
        error: "Offset must be non-negative",
      });
    }

    if (
      options.priority &&
      !["low", "medium", "high"].includes(options.priority)
    ) {
      return res.status(400).json({
        success: false,
        error: "Priority must be low, medium, or high",
      });
    }

    const result = await AlertService.getAlerts(userId, options);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch alerts";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /alerts
 * Create a new alert (typically used by system services)
 */
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { type, priority, title, message, metadata } = req.body;

    // Validation
    if (
      !type ||
      ![
        "budget_threshold",
        "budget_exceeded",
        "bill_reminder",
        "due_reminder",
        "unusual_activity",
        "system",
        "insight",
      ].includes(type)
    ) {
      return res.status(400).json({
        success: false,
        error: "Valid alert type is required",
      });
    }

    if (!priority || !["low", "medium", "high"].includes(priority)) {
      return res.status(400).json({
        success: false,
        error: "Valid priority is required",
      });
    }

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Title is required",
      });
    }

    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Message is required",
      });
    }

    const alert = await AlertService.createAlert({
      userId,
      type: type as AlertType,
      priority: priority as AlertPriority,
      title: title.trim(),
      message: message.trim(),
      metadata,
    });

    res.status(201).json({
      success: true,
      data: { alert },
    });
  } catch (error) {
    console.error("Error creating alert:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create alert";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * PUT /alerts/:id/read
 * Mark an alert as read
 */
router.put("/:id/read", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const alertId = req.params.id;

    if (!alertId) {
      return res.status(400).json({
        success: false,
        error: "Alert ID is required",
      });
    }

    await AlertService.markAsRead(alertId, userId);

    res.json({
      success: true,
      data: { message: "Alert marked as read" },
    });
  } catch (error) {
    console.error("Error marking alert as read:", error);
    const message =
      error instanceof Error ? error.message : "Failed to mark alert as read";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * PUT /alerts/read-multiple
 * Mark multiple alerts as read
 */
router.put("/read-multiple", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { alertIds } = req.body;

    // Validation
    if (!Array.isArray(alertIds) || alertIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Alert IDs array is required",
      });
    }

    if (alertIds.length > 50) {
      return res.status(400).json({
        success: false,
        error: "Maximum 50 alerts can be marked at once",
      });
    }

    if (
      !alertIds.every((id) => typeof id === "string" && id.trim().length > 0)
    ) {
      return res.status(400).json({
        success: false,
        error: "All alert IDs must be valid strings",
      });
    }

    await AlertService.markMultipleAsRead(alertIds, userId);

    res.json({
      success: true,
      data: { message: `${alertIds.length} alerts marked as read` },
    });
  } catch (error) {
    console.error("Error marking alerts as read:", error);
    const message =
      error instanceof Error ? error.message : "Failed to mark alerts as read";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * DELETE /alerts/:id
 * Delete an alert
 */
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const alertId = req.params.id;

    if (!alertId) {
      return res.status(400).json({
        success: false,
        error: "Alert ID is required",
      });
    }

    await AlertService.deleteAlert(alertId, userId);

    res.json({
      success: true,
      data: { message: "Alert deleted successfully" },
    });
  } catch (error) {
    console.error("Error deleting alert:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete alert";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /notifications/preferences
 * Get user notification preferences
 */
router.get(
  "/notifications/preferences",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      const preferences = await AlertService.getNotificationPreferences(userId);

      res.json({
        success: true,
        data: { preferences },
      });
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      const message =
        error instanceof Error ? error.message : "Failed to fetch preferences";
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  }
);

/**
 * PUT /notifications/preferences
 * Update user notification preferences
 */
router.put(
  "/notifications/preferences",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { enabled, channels, frequency, quietHours, alertTypes } = req.body;

      // Validation
      if (enabled !== undefined && typeof enabled !== "boolean") {
        return res.status(400).json({
          success: false,
          error: "enabled must be a boolean",
        });
      }

      if (
        channels &&
        (!Array.isArray(channels) ||
          !channels.every((c) =>
            ["email", "in_app", "sms", "push"].includes(c)
          ))
      ) {
        return res.status(400).json({
          success: false,
          error: "channels must be an array of valid channel types",
        });
      }

      if (
        frequency &&
        !["immediate", "daily_digest", "weekly_digest"].includes(frequency)
      ) {
        return res.status(400).json({
          success: false,
          error: "frequency must be immediate, daily_digest, or weekly_digest",
        });
      }

      if (quietHours) {
        if (
          typeof quietHours.enabled !== "boolean" ||
          !quietHours.start ||
          !quietHours.end ||
          !/^\d{2}:\d{2}$/.test(quietHours.start) ||
          !/^\d{2}:\d{2}$/.test(quietHours.end)
        ) {
          return res.status(400).json({
            success: false,
            error:
              "quietHours must have valid enabled, start, and end times (HH:mm format)",
          });
        }
      }

      const updatedPreferences =
        await AlertService.updateNotificationPreferences(userId, {
          enabled,
          channels,
          frequency,
          quietHours,
          alertTypes,
        });

      res.json({
        success: true,
        data: { preferences: updatedPreferences },
      });
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      const message =
        error instanceof Error ? error.message : "Failed to update preferences";
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  }
);

/**
 * POST /notifications/test
 * Test notification delivery for a specific channel
 */
router.post("/notifications/test", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      channel,
      message = "This is a test notification from your Credit Card Dashboard.",
    } = req.body;

    // Validation
    if (!channel || !["email", "in_app", "sms", "push"].includes(channel)) {
      return res.status(400).json({
        success: false,
        error: "Valid notification channel is required",
      });
    }

    if (typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Message must be a non-empty string",
      });
    }

    const result = await AlertService.testNotification(
      userId,
      channel as NotificationChannel,
      message.trim()
    );

    if (result.success) {
      res.json({
        success: true,
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
      });
    }
  } catch (error) {
    console.error("Error testing notification:", error);
    const message =
      error instanceof Error ? error.message : "Failed to test notification";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /alerts/generate-budget-alerts
 * Manually trigger budget alert generation (typically called by cron job)
 */
router.post(
  "/generate-budget-alerts",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      await AlertService.generateBudgetAlerts(userId);

      res.json({
        success: true,
        data: { message: "Budget alerts generated successfully" },
      });
    } catch (error) {
      console.error("Error generating budget alerts:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to generate budget alerts";
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  }
);

/**
 * GET /alerts/preferences
 * Get user notification preferences
 */
router.get("/preferences", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const preferences = await EnhancedAlertService.getNotificationPreferences(
      userId
    );

    res.json({
      success: true,
      data: { preferences },
    });
  } catch (error) {
    console.error("Error fetching preferences:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch preferences",
    });
  }
});

/**
 * PUT /alerts/preferences
 * Update user notification preferences
 */
router.put("/preferences", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const updates = req.body;

    const preferences =
      await EnhancedAlertService.updateNotificationPreferences(userId, updates);

    res.json({
      success: true,
      data: { preferences },
    });
  } catch (error) {
    console.error("Error updating preferences:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update preferences",
    });
  }
});

/**
 * GET /alerts/rules
 * Get all alert rules for user
 */
router.get("/rules", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const activeOnly = req.query.active_only !== "false";

    const rules = await EnhancedAlertService.getAlertRules(userId, activeOnly);

    res.json({
      success: true,
      data: { rules },
    });
  } catch (error) {
    console.error("Error fetching alert rules:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch rules",
    });
  }
});

/**
 * POST /alerts/rules
 * Create a new alert rule
 */
router.post("/rules", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { ruleName, ruleType, condition, alertPriority, alertChannels } =
      req.body;

    // Validation
    if (!ruleName || typeof ruleName !== "string") {
      return res.status(400).json({
        success: false,
        error: "Rule name is required",
      });
    }

    if (
      !ruleType ||
      ![
        "spending_threshold",
        "transaction_pattern",
        "merchant_alert",
        "category_limit",
        "card_usage",
      ].includes(ruleType)
    ) {
      return res.status(400).json({
        success: false,
        error: "Valid rule type is required",
      });
    }

    if (!condition || typeof condition !== "object") {
      return res.status(400).json({
        success: false,
        error: "Valid condition object is required",
      });
    }

    const rule = await EnhancedAlertService.createAlertRule(
      userId,
      ruleName,
      ruleType,
      condition,
      alertPriority || "medium",
      alertChannels || ["in_app", "email"]
    );

    res.status(201).json({
      success: true,
      data: { rule },
    });
  } catch (error) {
    console.error("Error creating alert rule:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create rule",
    });
  }
});

/**
 * PUT /alerts/rules/:ruleId
 * Update an alert rule
 */
router.put("/rules/:ruleId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { ruleId } = req.params;
    const updates = req.body;

    const rule = await EnhancedAlertService.updateAlertRule(
      ruleId,
      userId,
      updates
    );

    res.json({
      success: true,
      data: { rule },
    });
  } catch (error) {
    console.error("Error updating alert rule:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update rule",
    });
  }
});

/**
 * DELETE /alerts/rules/:ruleId
 * Delete an alert rule
 */
router.delete("/rules/:ruleId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { ruleId } = req.params;

    await EnhancedAlertService.deleteAlertRule(ruleId, userId);

    res.json({
      success: true,
      data: { message: "Rule deleted successfully" },
    });
  } catch (error) {
    console.error("Error deleting alert rule:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete rule",
    });
  }
});

/**
 * GET /alerts/:alertId/delivery
 * Get delivery status for an alert
 */
router.get("/:alertId/delivery", async (req: AuthRequest, res: Response) => {
  try {
    const { alertId } = req.params;

    const deliveryLogs = await EnhancedAlertService.getAlertDeliveryStatus(
      alertId
    );

    res.json({
      success: true,
      data: { deliveryLogs },
    });
  } catch (error) {
    console.error("Error fetching delivery status:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch delivery status",
    });
  }
});

/**
 * GET /alerts/statistics/delivery
 * Get delivery statistics for user
 */
router.get("/statistics/delivery", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const statistics = await EnhancedAlertService.getDeliveryStatistics(userId);

    res.json({
      success: true,
      data: { statistics },
    });
  } catch (error) {
    console.error("Error fetching delivery statistics:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch statistics",
    });
  }
});

/**
 * POST /alerts/:alertId/interact
 * Record user interaction with an alert
 */
router.post("/:alertId/interact", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { alertId } = req.params;
    const { interactionType, details } = req.body;

    // Validation
    if (
      !interactionType ||
      !["viewed", "clicked", "dismissed", "action_taken"].includes(
        interactionType
      )
    ) {
      return res.status(400).json({
        success: false,
        error: "Valid interaction type is required",
      });
    }

    await EnhancedAlertService.recordInteraction(
      alertId,
      userId,
      interactionType,
      details
    );

    res.json({
      success: true,
      data: { message: "Interaction recorded" },
    });
  } catch (error) {
    console.error("Error recording interaction:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to record interaction",
    });
  }
});

/**
 * GET /alerts/analytics
 * Get alert analytics for user
 */
router.get("/analytics", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const daysBack = req.query.days ? parseInt(req.query.days as string) : 30;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const analytics = await EnhancedAlertService.getAlertAnalytics(
      userId,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: { analytics },
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch analytics",
    });
  }
});

/**
 * POST /alerts/digest/generate
 * Generate daily or weekly digest
 */
router.post("/digest/generate", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { digestType = "daily" } = req.body;

    if (!["daily", "weekly"].includes(digestType)) {
      return res.status(400).json({
        success: false,
        error: "Digest type must be daily or weekly",
      });
    }

    const digest = await EnhancedAlertService.generateDigest(
      userId,
      digestType
    );

    if (!digest) {
      return res.json({
        success: true,
        data: { message: "No alerts to include in digest" },
      });
    }

    res.json({
      success: true,
      data: { digest },
    });
  } catch (error) {
    console.error("Error generating digest:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate digest",
    });
  }
});

/**
 * POST /alerts/batch-send
 * Batch send pending notifications (for scheduled jobs)
 */
router.post("/batch-send", async (req: AuthRequest, res: Response) => {
  try {
    // This endpoint should be protected with admin/system auth in production
    const result = await EnhancedAlertService.batchSendNotifications();

    res.json({
      success: true,
      data: { result },
    });
  } catch (error) {
    console.error("Error batch sending notifications:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to batch send",
    });
  }
});

/**
 * POST /alerts/from-template
 * Create alert from template with variables
 */
router.post("/from-template", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { alertType, priority, variables } = req.body;

    // Validation
    if (!alertType || !priority) {
      return res.status(400).json({
        success: false,
        error: "Alert type and priority are required",
      });
    }

    if (!variables || typeof variables !== "object") {
      return res.status(400).json({
        success: false,
        error: "Variables object is required",
      });
    }

    const alert = await EnhancedAlertService.createAlertFromTemplate(
      userId,
      alertType,
      priority,
      variables
    );

    res.status(201).json({
      success: true,
      data: { alert },
    });
  } catch (error) {
    console.error("Error creating alert from template:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create alert",
    });
  }
});

export default router;
