import { Router } from "express";
import { AiInsightsController } from "./ai-insights.controller";
import { authenticate } from "@common/middleware/auth";

const router = Router();

/**
 * @route   POST /api/ai-insights
 * @desc    Create new ai-insights
 * @access  Protected
 */
router.post("/", authenticate, AiInsightsController.create);

/**
 * @route   GET /api/ai-insights/:id
 * @desc    Get ai-insights by ID
 * @access  Protected
 */
router.get("/:id", authenticate, AiInsightsController.getById);

/**
 * @route   GET /api/ai-insights
 * @desc    Get all ai-insights
 * @access  Protected
 */
router.get("/", authenticate, AiInsightsController.getAll);

/**
 * @route   PUT /api/ai-insights/:id
 * @desc    Update ai-insights
 * @access  Protected
 */
router.put("/:id", authenticate, AiInsightsController.update);

/**
 * @route   DELETE /api/ai-insights/:id
 * @desc    Delete ai-insights
 * @access  Protected
 */
router.delete("/:id", authenticate, AiInsightsController.delete);

export default router;
