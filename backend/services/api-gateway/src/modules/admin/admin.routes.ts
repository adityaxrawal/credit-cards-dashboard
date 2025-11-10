/**
 * Admin Routes
 * System monitoring and health check endpoints
 */

import { Router } from "express";
import { AdminController } from "./admin.controller";
import { authenticate } from "@common/middleware/auth";
import { isAdmin } from "@common/middleware/admin-guard";

const router = Router();

/**
 * @route   GET /api/admin/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get("/health", AdminController.healthCheck);

/**
 * @route   GET /api/admin/metrics
 * @desc    Get system metrics
 * @access  Admin only
 */
router.get("/metrics", authenticate, isAdmin, AdminController.getMetrics);

export default router;
