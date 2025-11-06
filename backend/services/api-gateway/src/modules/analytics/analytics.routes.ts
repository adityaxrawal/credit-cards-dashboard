import { Router } from "express";
import { AnalyticsController } from "./analytics.controller";
import { authenticate } from "@common/middleware/auth";

const router = Router();

/**
 * @route   POST /api/analytics
 * @desc    Create new analytics
 * @access  Protected
 */
router.post("/", authenticate, AnalyticsController.create);

/**
 * @route   GET /api/analytics/:id
 * @desc    Get analytics by ID
 * @access  Protected
 */
router.get("/:id", authenticate, AnalyticsController.getById);

/**
 * @route   GET /api/analytics
 * @desc    Get all analytics
 * @access  Protected
 */
router.get("/", authenticate, AnalyticsController.getAll);

/**
 * @route   PUT /api/analytics/:id
 * @desc    Update analytics
 * @access  Protected
 */
router.put("/:id", authenticate, AnalyticsController.update);

/**
 * @route   DELETE /api/analytics/:id
 * @desc    Delete analytics
 * @access  Protected
 */
router.delete("/:id", authenticate, AnalyticsController.delete);

export default router;
