import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import DashboardService from "../services/dashboard.service";

const router = Router();
const dashboardService = new DashboardService();

// All routes require authentication
router.use(authenticate);

/**
 * GET /analytics/dashboard
 * Get dashboard overview statistics
 */
router.get("/dashboard", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const overview = await dashboardService.getDashboardOverview(userId);

    res.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    console.error("Error fetching dashboard overview:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch dashboard overview";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /analytics/spending-by-category
 * Get spending breakdown by category
 */
router.get("/spending-by-category", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const result = await dashboardService.getSpendingByCategory(
      userId,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching category spending:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch category spending";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /analytics/spending-trend
 * Get spending trend over time
 */
router.get("/spending-trend", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const period = (req.query.period as "week" | "month" | "year") || "month";
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 12;

    const trend = await dashboardService.getSpendingTrend(
      userId,
      period,
      limit
    );

    res.json({
      success: true,
      data: { trend },
    });
  } catch (error) {
    console.error("Error fetching spending trend:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch spending trend";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /analytics/upcoming-bills
 * Get upcoming bill due dates
 */
router.get("/upcoming-bills", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const daysAhead = req.query.days ? parseInt(req.query.days as string) : 30;

    const bills = await dashboardService.getUpcomingBills(userId, daysAhead);

    res.json({
      success: true,
      data: { bills },
    });
  } catch (error) {
    console.error("Error fetching upcoming bills:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch upcoming bills";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /analytics/card-utilization
 * Get credit utilization by card
 */
router.get("/card-utilization", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const utilization = await dashboardService.getCardUtilization(userId);

    res.json({
      success: true,
      data: { cards: utilization },
    });
  } catch (error) {
    console.error("Error fetching card utilization:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch card utilization";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /analytics/monthly-comparison
 * Compare current month with previous month
 */
router.get("/monthly-comparison", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const comparison = await dashboardService.getMonthlyComparison(userId);

    res.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    console.error("Error fetching monthly comparison:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch monthly comparison";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

export default router;
