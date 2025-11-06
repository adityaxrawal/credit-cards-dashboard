import { Router } from "express";
import { AlertsController } from "./alerts.controller";
import { authenticate } from "@common/middleware/auth";

const router = Router();

/**
 * @route   POST /api/alerts
 * @desc    Create new alerts
 * @access  Protected
 */
router.post("/", authenticate, AlertsController.create);

/**
 * @route   GET /api/alerts/:id
 * @desc    Get alerts by ID
 * @access  Protected
 */
router.get("/:id", authenticate, AlertsController.getById);

/**
 * @route   GET /api/alerts
 * @desc    Get all alerts
 * @access  Protected
 */
router.get("/", authenticate, AlertsController.getAll);

/**
 * @route   PUT /api/alerts/:id
 * @desc    Update alerts
 * @access  Protected
 */
router.put("/:id", authenticate, AlertsController.update);

/**
 * @route   DELETE /api/alerts/:id
 * @desc    Delete alerts
 * @access  Protected
 */
router.delete("/:id", authenticate, AlertsController.delete);

export default router;
