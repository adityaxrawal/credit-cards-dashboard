import { Router, Request, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { BackgroundJobService } from "../services/background-jobs.service";

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /jobs/status
 * Get status of all background jobs
 */
router.get("/status", async (req: AuthRequest, res: Response) => {
  try {
    const status = BackgroundJobService.getJobsStatus();

    res.json({
      success: true,
      data: { jobs: status },
    });
  } catch (error) {
    console.error("Error getting job status:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get job status";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /jobs/:jobName/run
 * Run a specific job manually
 */
router.post("/:jobName/run", async (req: AuthRequest, res: Response) => {
  try {
    const { jobName } = req.params;

    const validJobs = [
      "budget-alerts",
      "bill-reminders",
      "unusual-activity",
      "budget-tracking-update",
      "daily-digest",
      "weekly-digest",
    ];

    if (!validJobs.includes(jobName)) {
      return res.status(400).json({
        success: false,
        error: `Invalid job name. Valid jobs: ${validJobs.join(", ")}`,
      });
    }

    await BackgroundJobService.runJob(jobName);

    res.json({
      success: true,
      data: { message: `Job '${jobName}' executed successfully` },
    });
  } catch (error) {
    console.error(`Error running job ${req.params.jobName}:`, error);
    const message =
      error instanceof Error
        ? error.message
        : `Failed to run job ${req.params.jobName}`;
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /jobs/start-all
 * Start all background jobs
 */
router.post("/start-all", async (req: AuthRequest, res: Response) => {
  try {
    BackgroundJobService.startAllJobs();

    res.json({
      success: true,
      data: { message: "All background jobs started successfully" },
    });
  } catch (error) {
    console.error("Error starting background jobs:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to start background jobs";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /jobs/stop-all
 * Stop all background jobs
 */
router.post("/stop-all", async (req: AuthRequest, res: Response) => {
  try {
    BackgroundJobService.stopAllJobs();

    res.json({
      success: true,
      data: { message: "All background jobs stopped successfully" },
    });
  } catch (error) {
    console.error("Error stopping background jobs:", error);
    const message =
      error instanceof Error ? error.message : "Failed to stop background jobs";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

export default router;
