import { Router, Request, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { RecurringTransactionService } from "../services/recurring-transaction.service";
import { body, param, query, validationResult } from "express-validator";
import { AppError } from "../middleware/errorHandler";

const router = Router();

/**
 * Validation middleware helper
 */
const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * GET /api/recurring-transactions
 * Get user's recurring transactions
 */
router.get(
  "/",
  authenticate,
  query("status").optional().isIn(["active", "paused", "completed", "cancelled"]),
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const status = req.query.status as any;

      const recurringTransactions =
        await RecurringTransactionService.getUserRecurringTransactions(userId, status);

      res.json({
        success: true,
        data: recurringTransactions,
        count: recurringTransactions.length,
      });
    } catch (error: any) {
      console.error("Error fetching recurring transactions:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch recurring transactions",
      });
    }
  }
);

/**
 * GET /api/recurring-transactions/upcoming
 * Get upcoming recurring transactions
 */
router.get(
  "/upcoming",
  authenticate,
  query("days").optional().isInt({ min: 1, max: 365 }),
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const days = parseInt(req.query.days as string) || 30;

      const upcoming =
        await RecurringTransactionService.getUpcomingRecurringTransactions(userId, days);

      res.json({
        success: true,
        data: upcoming,
        count: upcoming.length,
      });
    } catch (error: any) {
      console.error("Error fetching upcoming recurring transactions:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch upcoming recurring transactions",
      });
    }
  }
);

/**
 * GET /api/recurring-transactions/:id
 * Get a single recurring transaction
 */
router.get(
  "/:id",
  authenticate,
  param("id").isUUID(),
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const recurringTransaction =
        await RecurringTransactionService.getRecurringTransaction(id, userId);

      if (!recurringTransaction) {
        return res.status(404).json({
          success: false,
          error: "Recurring transaction not found",
        });
      }

      res.json({
        success: true,
        data: recurringTransaction,
      });
    } catch (error: any) {
      console.error("Error fetching recurring transaction:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch recurring transaction",
      });
    }
  }
);

/**
 * GET /api/recurring-transactions/:id/history
 * Get execution history for a recurring transaction
 */
router.get(
  "/:id/history",
  authenticate,
  param("id").isUUID(),
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const history = await RecurringTransactionService.getExecutionHistory(id, userId);

      res.json({
        success: true,
        data: history,
        count: history.length,
      });
    } catch (error: any) {
      console.error("Error fetching execution history:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch execution history",
      });
    }
  }
);

/**
 * POST /api/recurring-transactions
 * Create a new recurring transaction
 */
router.post(
  "/",
  authenticate,
  [
    body("card_id").isUUID().withMessage("Valid card ID is required"),
    body("merchant_name")
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage("Merchant name is required (1-255 characters)"),
    body("amount")
      .isFloat({ min: 0.01 })
      .withMessage("Amount must be greater than 0"),
    body("frequency")
      .isIn(["daily", "weekly", "biweekly", "monthly", "quarterly", "annually"])
      .withMessage("Valid frequency is required"),
    body("start_date")
      .isISO8601()
      .withMessage("Valid start date is required"),
    body("end_date")
      .optional()
      .isISO8601()
      .withMessage("Valid end date is required if provided"),
    body("category").optional().trim(),
    body("description").optional().trim(),
    body("max_executions")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Max executions must be at least 1"),
    body("timezone").optional().trim(),
    body("notification_enabled").optional().isBoolean(),
    body("auto_execute").optional().isBoolean(),
    body("metadata").optional().isObject(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const data = {
        ...req.body,
        user_id: userId,
        status: "active",
      };

      const recurringTransaction =
        await RecurringTransactionService.createRecurringTransaction(data);

      res.status(201).json({
        success: true,
        data: recurringTransaction,
        message: "Recurring transaction created successfully",
      });
    } catch (error: any) {
      console.error("Error creating recurring transaction:", error);
      res.status(400).json({
        success: false,
        error: error.message || "Failed to create recurring transaction",
      });
    }
  }
);

/**
 * PUT /api/recurring-transactions/:id
 * Update a recurring transaction
 */
router.put(
  "/:id",
  authenticate,
  [
    param("id").isUUID(),
    body("merchant_name")
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 }),
    body("amount")
      .optional()
      .isFloat({ min: 0.01 }),
    body("frequency")
      .optional()
      .isIn(["daily", "weekly", "biweekly", "monthly", "quarterly", "annually"]),
    body("start_date").optional().isISO8601(),
    body("end_date").optional().isISO8601(),
    body("category").optional().trim(),
    body("description").optional().trim(),
    body("max_executions").optional().isInt({ min: 1 }),
    body("notification_enabled").optional().isBoolean(),
    body("auto_execute").optional().isBoolean(),
    body("metadata").optional().isObject(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const recurringTransaction =
        await RecurringTransactionService.updateRecurringTransaction(
          id,
          userId,
          req.body
        );

      res.json({
        success: true,
        data: recurringTransaction,
        message: "Recurring transaction updated successfully",
      });
    } catch (error: any) {
      console.error("Error updating recurring transaction:", error);
      res.status(400).json({
        success: false,
        error: error.message || "Failed to update recurring transaction",
      });
    }
  }
);

/**
 * POST /api/recurring-transactions/:id/pause
 * Pause a recurring transaction
 */
router.post(
  "/:id/pause",
  authenticate,
  param("id").isUUID(),
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      await RecurringTransactionService.pauseRecurringTransaction(id, userId);

      res.json({
        success: true,
        message: "Recurring transaction paused successfully",
      });
    } catch (error: any) {
      console.error("Error pausing recurring transaction:", error);
      res.status(400).json({
        success: false,
        error: error.message || "Failed to pause recurring transaction",
      });
    }
  }
);

/**
 * POST /api/recurring-transactions/:id/resume
 * Resume a paused recurring transaction
 */
router.post(
  "/:id/resume",
  authenticate,
  param("id").isUUID(),
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      await RecurringTransactionService.resumeRecurringTransaction(id, userId);

      res.json({
        success: true,
        message: "Recurring transaction resumed successfully",
      });
    } catch (error: any) {
      console.error("Error resuming recurring transaction:", error);
      res.status(400).json({
        success: false,
        error: error.message || "Failed to resume recurring transaction",
      });
    }
  }
);

/**
 * POST /api/recurring-transactions/:id/cancel
 * Cancel a recurring transaction
 */
router.post(
  "/:id/cancel",
  authenticate,
  param("id").isUUID(),
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      await RecurringTransactionService.cancelRecurringTransaction(id, userId);

      res.json({
        success: true,
        message: "Recurring transaction cancelled successfully",
      });
    } catch (error: any) {
      console.error("Error cancelling recurring transaction:", error);
      res.status(400).json({
        success: false,
        error: error.message || "Failed to cancel recurring transaction",
      });
    }
  }
);

/**
 * POST /api/recurring-transactions/executions/:executionId/confirm
 * Confirm a pending execution
 */
router.post(
  "/executions/:executionId/confirm",
  authenticate,
  param("executionId").isUUID(),
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { executionId } = req.params;

      await RecurringTransactionService.confirmPendingExecution(
        executionId,
        userId
      );

      res.json({
        success: true,
        message: "Execution confirmed and transaction created successfully",
      });
    } catch (error: any) {
      console.error("Error confirming execution:", error);
      res.status(400).json({
        success: false,
        error: error.message || "Failed to confirm execution",
      });
    }
  }
);

/**
 * POST /api/recurring-transactions/executions/:executionId/skip
 * Skip a pending execution
 */
router.post(
  "/executions/:executionId/skip",
  authenticate,
  [
    param("executionId").isUUID(),
    body("reason").optional().trim().isLength({ max: 500 }),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { executionId } = req.params;
      const { reason } = req.body;

      await RecurringTransactionService.skipPendingExecution(
        executionId,
        userId,
        reason
      );

      res.json({
        success: true,
        message: "Execution skipped successfully",
      });
    } catch (error: any) {
      console.error("Error skipping execution:", error);
      res.status(400).json({
        success: false,
        error: error.message || "Failed to skip execution",
      });
    }
  }
);

export default router;
