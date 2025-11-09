/**
 * Admin Controller
 * Handles admin-only endpoints for system monitoring
 */

import { Response } from "express";
import { AuthRequest } from "@common/middleware/auth";
import { getSystemMetrics } from "./admin.service";
import { logger } from "shared/monitoring/logger";
import { HTTP_STATUS } from "../../constants";

export class AdminController {
  /**
   * @route   GET /api/admin/metrics
   * @desc    Get system health metrics
   * @access  Admin only
   */
  static async getMetrics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const metrics = await getSystemMetrics();
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error("Failed to get system metrics:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: "Failed to retrieve system metrics",
      });
    }
  }

  /**
   * @route   GET /api/admin/health
   * @desc    Simple health check endpoint
   * @access  Public
   */
  static async healthCheck(_req: AuthRequest, res: Response): Promise<void> {
    res.status(HTTP_STATUS.OK).json({
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  }
}
