import express, { Request, Response } from "express";
import { BillReminderService } from "../services/bill-reminder.service";

const router = express.Router();

// Custom request interface for authenticated routes
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
  };
}

/**
 * @route GET /api/bills
 * @desc Get bills for authenticated user
 */
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { status = "all", cardId, limit = "50", offset = "0" } = req.query;

    const options = {
      status: status as "pending" | "paid" | "overdue" | "all",
      cardId: cardId as string | undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    };

    const result = await BillReminderService.getBills(userId, options);

    res.json({
      success: true,
      data: {
        bills: result.bills,
        total: result.total,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          hasMore: result.total > options.offset + options.limit,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching bills:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch bills",
    });
  }
});

/**
 * @route GET /api/bills/upcoming
 * @desc Get upcoming bills (next 30 days)
 */
router.get("/upcoming", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const upcomingBills = await BillReminderService.getUpcomingBills(userId);

    res.json({
      success: true,
      data: {
        bills: upcomingBills,
        count: upcomingBills.length,
      },
    });
  } catch (error) {
    console.error("Error fetching upcoming bills:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch upcoming bills",
    });
  }
});

/**
 * @route POST /api/bills/generate
 * @desc Generate bills for all cards or specific card
 */
router.post("/generate", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { cardId } = req.body;

    let result;
    if (cardId) {
      // Generate bill for specific card
      result = await BillReminderService.generateBillForCard(cardId);
      res.json({
        success: true,
        data: {
          generated: result.generated ? 1 : 0,
          updated: result.updated ? 1 : 0,
          bill: result.bill,
          message: result.generated
            ? "Bill generated successfully"
            : "No bill generated (not due yet or already exists)",
        },
      });
    } else {
      // Generate bills for all cards
      result = await BillReminderService.generateBillsForAllCards();
      res.json({
        success: true,
        data: {
          generated: result.generated,
          updated: result.updated,
          errors: result.errors,
          message: `Generated ${result.generated} bills, updated ${result.updated} bills`,
        },
      });
    }
  } catch (error) {
    console.error("Error generating bills:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate bills",
    });
  }
});

/**
 * @route POST /api/bills/:billId/pay
 * @desc Mark a bill as paid
 */
router.post(
  "/:billId/pay",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { billId } = req.params;
      const {
        amount,
        paymentMethod = "manual",
        paymentDate,
        transactionId,
        notes,
      } = req.body;

      // Validate required fields
      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: "Valid payment amount is required",
        });
      }

      const validPaymentMethods = [
        "auto_pay",
        "manual",
        "bank_transfer",
        "other",
      ];
      if (!validPaymentMethods.includes(paymentMethod)) {
        return res.status(400).json({
          success: false,
          error: "Invalid payment method",
        });
      }

      const paymentDetails = {
        amount: parseFloat(amount),
        paymentMethod,
        paymentDate: paymentDate ? new Date(paymentDate) : undefined,
        transactionId,
        notes,
      };

      const result = await BillReminderService.markBillAsPaid(
        billId,
        userId,
        paymentDetails
      );

      res.json({
        success: true,
        data: {
          bill: result.bill,
          payment: result.payment,
          message: "Payment recorded successfully",
        },
      });
    } catch (error) {
      console.error("Error recording payment:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to record payment",
      });
    }
  }
);

/**
 * @route GET /api/bills/payments
 * @desc Get payment history
 */
router.get("/payments", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { cardId, limit = "50", offset = "0" } = req.query;

    const options = {
      cardId: cardId as string | undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    };

    const result = await BillReminderService.getPaymentHistory(userId, options);

    res.json({
      success: true,
      data: {
        payments: result.payments,
        total: result.total,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          hasMore: result.total > options.offset + options.limit,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch payment history",
    });
  }
});

/**
 * @route GET /api/bills/settings
 * @desc Get bill reminder settings
 */
router.get("/settings", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const settings = await BillReminderService.getReminderSettings(userId);

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error fetching reminder settings:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch reminder settings",
    });
  }
});

/**
 * @route PUT /api/bills/settings
 * @desc Update bill reminder settings
 */
router.put("/settings", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const {
      enableReminders,
      reminderDays,
      enableAutoPayReminders,
      preferredTime,
      channels,
    } = req.body;

    // Validate reminder days
    if (reminderDays && Array.isArray(reminderDays)) {
      const validDays = reminderDays.every(
        (day: any) => typeof day === "number" && day > 0 && day <= 30
      );
      if (!validDays) {
        return res.status(400).json({
          success: false,
          error: "Reminder days must be numbers between 1 and 30",
        });
      }
    }

    // Validate channels
    if (channels && Array.isArray(channels)) {
      const validChannels = ["email", "sms", "push", "in_app"];
      const allValid = channels.every((channel: string) =>
        validChannels.includes(channel)
      );
      if (!allValid) {
        return res.status(400).json({
          success: false,
          error: "Invalid notification channels",
        });
      }
    }

    // Validate time format (HH:MM)
    if (
      preferredTime &&
      !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(preferredTime)
    ) {
      return res.status(400).json({
        success: false,
        error: "Preferred time must be in HH:MM format",
      });
    }

    const settingsUpdate = {
      enableReminders,
      reminderDays,
      enableAutoPayReminders,
      preferredTime,
      channels,
    };

    const updatedSettings = await BillReminderService.updateReminderSettings(
      userId,
      settingsUpdate
    );

    res.json({
      success: true,
      data: updatedSettings,
      message: "Reminder settings updated successfully",
    });
  } catch (error) {
    console.error("Error updating reminder settings:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update reminder settings",
    });
  }
});

/**
 * @route POST /api/bills/check-overdue
 * @desc Check and update overdue bills (admin/system endpoint)
 */
router.post(
  "/check-overdue",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await BillReminderService.checkOverdueBills();

      res.json({
        success: true,
        data: {
          updated: result.updated,
          notified: result.notified,
          message: `Updated ${result.updated} overdue bills, sent ${result.notified} notifications`,
        },
      });
    } catch (error) {
      console.error("Error checking overdue bills:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to check overdue bills",
      });
    }
  }
);

/**
 * @route POST /api/bills/:billId/schedule-reminders
 * @desc Schedule reminders for a specific bill
 */
router.post(
  "/:billId/schedule-reminders",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { billId } = req.params;

      await BillReminderService.scheduleReminders(billId);

      res.json({
        success: true,
        message: "Reminders scheduled successfully",
      });
    } catch (error) {
      console.error("Error scheduling reminders:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to schedule reminders",
      });
    }
  }
);

export default router;
