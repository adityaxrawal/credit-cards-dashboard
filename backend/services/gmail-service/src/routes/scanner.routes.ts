import express from "express";
import { historicalScanner } from "../scanner/historical-scanner";
import { logger } from "../utils/logger";

const router = express.Router();

/**
 * Start historical scan
 * POST /scanner/start
 * Body: { startDate: string, endDate: string, labelFilter?: string }
 */
router.post("/start", async (req, res) => {
  try {
    const userId = (req as any).user?.id; // Assuming auth middleware sets req.user
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { startDate, endDate, labelFilter } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate required" });
    }

    const jobId = await historicalScanner.startScan({
      userId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      labelFilter,
    });

    logger.info({ userId, jobId }, "Scan started");

    res.json({ jobId, status: "pending" });
  } catch (error) {
    logger.error({ error }, "Failed to start scan");
    res.status(500).json({ error: "Failed to start scan" });
  }
});

/**
 * Get scan progress
 * GET /scanner/progress/:jobId
 */
router.get("/progress/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;

    const progress = await historicalScanner.getProgress(jobId);

    if (!progress) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json(progress);
  } catch (error) {
    logger.error({ error }, "Failed to get progress");
    res.status(500).json({ error: "Failed to get progress" });
  }
});

/**
 * Pause scan
 * POST /scanner/:jobId/pause
 */
router.post("/:jobId/pause", async (req, res) => {
  try {
    const { jobId } = req.params;

    await historicalScanner.pauseScan(jobId);

    res.json({ status: "paused" });
  } catch (error) {
    logger.error({ error }, "Failed to pause scan");
    res.status(500).json({ error: "Failed to pause scan" });
  }
});

/**
 * Resume scan
 * POST /scanner/:jobId/resume
 */
router.post("/:jobId/resume", async (req, res) => {
  try {
    const { jobId } = req.params;

    await historicalScanner.resumeScan(jobId);

    res.json({ status: "running" });
  } catch (error) {
    logger.error({ error }, "Failed to resume scan");
    res.status(500).json({ error: "Failed to resume scan" });
  }
});

export default router;
