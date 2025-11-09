/**
 * Internal Cache Metrics Routes
 *
 * Protected endpoints for monitoring cache performance
 */

import { Router, Response } from "express";
import { AuthRequest, authenticate as authMiddleware } from "../common/middleware/auth";
import {
  getCacheMetricsForUser,
  getCacheMetricsForModule,
  getGlobalCacheMetrics,
  resetCacheMetrics,
  logCacheMetrics,
} from "shared/cache/cache-metrics";

const router = Router();

/**
 * GET /api/internal/cache-metrics
 * Get cache metrics for the authenticated user
 * Query params:
 *   - module: Module name (optional, returns all modules if not specified)
 *   - global: If true, returns global metrics (admin use)
 */
router.get(
  "/cache-metrics",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { module, global } = req.query;
      const userId = req.userId!;

      if (global === "true") {
        // Return global metrics (could add admin check here)
        const metrics = getGlobalCacheMetrics();
        res.json({
          success: true,
          data: metrics,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (module && typeof module === "string") {
        // Return module-specific metrics for user
        const metrics = getCacheMetricsForUser(module, userId);
        res.json({
          success: true,
          data: {
            module,
            userId,
            ...metrics,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Return all metrics for user across all modules
      const globalMetrics = getGlobalCacheMetrics();
      const userModules: Record<string, ReturnType<typeof getCacheMetricsForUser>> = {};

      Object.keys(globalMetrics.modules).forEach((mod) => {
        userModules[mod] = getCacheMetricsForUser(mod, userId);
      });

      res.json({
        success: true,
        data: {
          userId,
          modules: userModules,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to retrieve cache metrics",
      });
    }
  }
);

/**
 * GET /api/internal/cache-metrics/module/:moduleName
 * Get all cache metrics for a specific module
 */
router.get(
  "/cache-metrics/module/:moduleName",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { moduleName } = req.params;
      const metrics = getCacheMetricsForModule(moduleName);

      res.json({
        success: true,
        data: {
          module: moduleName,
          ...metrics,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to retrieve module metrics",
      });
    }
  }
);

/**
 * POST /api/internal/cache-metrics/reset
 * Reset cache metrics
 * Body params:
 *   - module: Module name (optional)
 *   - userId: User ID (optional, defaults to authenticated user)
 */
router.post(
  "/cache-metrics/reset",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { module } = req.body;
      const userId = req.userId!;

      resetCacheMetrics(module, userId);

      res.json({
        success: true,
        message: "Cache metrics reset successfully",
        resetFor: {
          module: module || "all",
          userId,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to reset cache metrics",
      });
    }
  }
);

/**
 * POST /api/internal/cache-metrics/log
 * Log current cache metrics to console/logger
 */
router.post(
  "/cache-metrics/log",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      logCacheMetrics();

      res.json({
        success: true,
        message: "Cache metrics logged successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to log cache metrics",
      });
    }
  }
);

export default router;
