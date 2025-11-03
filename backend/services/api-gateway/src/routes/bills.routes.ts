import express, { Request, Response } from "express";
import { BillReminderService } from "../services/bill-reminder.service";

const router = express.Router();

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
  };
}

/**
 * @route GET /api/bills
 * @desc Get all bills for a user
 */
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { cardId, limit, offset } = req.query;

    const bills = await BillReminderService.getAllBills(userId, {
      cardId: cardId as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({ success: true, data: bills });
  } catch (error: any) {
    console.error("Error fetching bills:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/bills/reminders
 * @desc Create a bill reminder
 */
router.post("/reminders", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const reminderData = {
      ...req.body,
      dueDate: new Date(req.body.dueDate),
      reminderDate: new Date(req.body.reminderDate),
    };

    const reminder = await BillReminderService.createBillReminder(
      userId,
      reminderData
    );

    res.json({ success: true, data: reminder });
  } catch (error: any) {
    console.error("Error creating bill reminder:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/bills/reminders
 * @desc Get bill reminders
 */
router.get("/reminders", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { status, startDate, endDate, isRecurring } = req.query;

    const filters: any = {};
    if (status) filters.status = status;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    if (isRecurring !== undefined) filters.isRecurring = isRecurring === "true";

    const reminders = await BillReminderService.getBillReminders(
      userId,
      filters
    );

    res.json({ success: true, data: reminders });
  } catch (error: any) {
    console.error("Error fetching bill reminders:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route PUT /api/bills/reminders/:id/paid
 * @desc Mark a bill as paid
 */
router.put(
  "/reminders/:id/paid",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { id } = req.params;
      const paidData = {
        amount: req.body.amount,
        paymentDate: req.body.paymentDate
          ? new Date(req.body.paymentDate)
          : undefined,
        paymentMethod: req.body.paymentMethod,
        notes: req.body.notes,
      };

      await BillReminderService.markBillAsPaid(userId, id, paidData);

      res.json({ success: true, message: "Bill marked as paid" });
    } catch (error: any) {
      console.error("Error marking bill as paid:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * @route GET /api/bills/calendar
 * @desc Get calendar events for bills
 */
router.get("/calendar", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "startDate and endDate are required",
      });
    }

    const events = await BillReminderService.getBillCalendarEvents(
      userId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({ success: true, data: events });
  } catch (error: any) {
    console.error("Error fetching calendar events:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/bills/recurring-templates
 * @desc Create a recurring bill template
 */
router.post(
  "/recurring-templates",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const template = await BillReminderService.createRecurringTemplate(
        userId,
        req.body
      );

      res.json({ success: true, data: template });
    } catch (error: any) {
      console.error("Error creating recurring template:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * @route GET /api/bills/recurring-templates
 * @desc Get recurring bill templates
 */
router.get(
  "/recurring-templates",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { activeOnly } = req.query;
      const templates = await BillReminderService.getRecurringTemplates(
        userId,
        activeOnly === "true"
      );

      res.json({ success: true, data: templates });
    } catch (error: any) {
      console.error("Error fetching recurring templates:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * @route POST /api/bills/detect-recurring
 * @desc Detect recurring bills from transaction history
 */
router.post(
  "/detect-recurring",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const result = await BillReminderService.detectRecurringBills(userId);

      res.json({
        success: true,
        message: `Detected ${result.detectedCount} recurring bills`,
        data: result,
      });
    } catch (error: any) {
      console.error("Error detecting recurring bills:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

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

    res.json({ success: true, data: settings });
  } catch (error: any) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ success: false, error: error.message });
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

    const settings = await BillReminderService.updateReminderSettings(
      userId,
      req.body
    );

    res.json({ success: true, data: settings });
  } catch (error: any) {
    console.error("Error updating settings:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/bills/payment-history
 * @desc Get payment history
 */
router.get(
  "/payment-history",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { cardId, limit, offset } = req.query;

      const history = await BillReminderService.getPaymentHistory(userId, {
        cardId: cardId as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.json({ success: true, data: history });
    } catch (error: any) {
      console.error("Error fetching payment history:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * @route GET /api/bills/upcoming
 * @desc Get upcoming bills
 */
router.get("/upcoming", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { cardId } = req.query;
    const upcomingBills = await BillReminderService.getUpcomingBills(
      userId,
      cardId as string
    );

    res.json({ success: true, data: upcomingBills });
  } catch (error: any) {
    console.error("Error fetching upcoming bills:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/bills/cron/generate-recurring
 * @desc Generate bills from recurring templates (cron job)
 */
router.post("/cron/generate-recurring", async (req: Request, res: Response) => {
  try {
    // TODO: Add cron authentication middleware
    const result = await BillReminderService.generateRecurringBills();

    res.json({
      success: true,
      message: `Generated ${result.generatedCount} bills`,
      data: result,
    });
  } catch (error: any) {
    console.error("Error generating recurring bills:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/bills/cron/check-overdue
 * @desc Check and mark overdue bills (cron job)
 */
router.post("/cron/check-overdue", async (req: Request, res: Response) => {
  try {
    // TODO: Add cron authentication middleware
    await BillReminderService.checkOverdueBills();

    res.json({ success: true, message: "Overdue bills checked" });
  } catch (error: any) {
    console.error("Error checking overdue bills:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/bills/cron/send-reminders
 * @desc Send upcoming bill reminders (cron job)
 */
router.post("/cron/send-reminders", async (req: Request, res: Response) => {
  try {
    // TODO: Add cron authentication middleware
    const result = await BillReminderService.sendUpcomingReminders();

    res.json({
      success: true,
      message: `Sent ${result.sent} reminders, ${result.failed} failed`,
      data: result,
    });
  } catch (error: any) {
    console.error("Error sending reminders:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
