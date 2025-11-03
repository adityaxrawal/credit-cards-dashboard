/**
 * Monitoring and Health Routes
 * Phase 6: Post-Launch & Optimization
 */

import { Router } from "express";
import { healthCheck } from "../../../../monitoring/health-check";
import { metricsCollector } from "../../../../monitoring/metrics-collector";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

/**
 * GET /api/monitoring/health
 * Public health check endpoint
 */
router.get("/health", async (req, res) => {
  try {
    const health = await healthCheck();

    const statusCode =
      health.status === "healthy"
        ? 200
        : health.status === "degraded"
        ? 200
        : 503;

    res.status(statusCode).json(health);
  } catch (error: any) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: Date.now(),
      error: error.message,
    });
  }
});

/**
 * GET /api/monitoring/metrics
 * Protected metrics summary endpoint (admin only)
 */
router.get("/metrics", authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    const summary = await metricsCollector.getMetricsSummary();

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/monitoring/status
 * System status overview
 */
router.get("/status", async (req, res) => {
  try {
    const [health, metrics] = await Promise.all([
      healthCheck(),
      metricsCollector.getMetricsSummary(),
    ]);

    res.json({
      health,
      metrics,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * GET /api/monitoring/readiness
 * Kubernetes readiness probe
 */
router.get("/readiness", async (req, res) => {
  try {
    const health = await healthCheck();

    if (health.status === "unhealthy") {
      return res.status(503).json({ ready: false });
    }

    res.json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false });
  }
});

/**
 * GET /api/monitoring/liveness
 * Kubernetes liveness probe
 */
router.get("/liveness", (req, res) => {
  res.json({ alive: true });
});

export default router;
