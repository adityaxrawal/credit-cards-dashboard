import { Router } from "express";
import { ReportsController } from "./reports.controller";
import { authenticate } from "@common/middleware/auth";

const router = Router();

/**
 * @route   POST /api/reports
 * @desc    Create new reports
 * @access  Protected
 */
router.post("/", authenticate, ReportsController.create);

/**
 * @route   GET /api/reports/:id
 * @desc    Get reports by ID
 * @access  Protected
 */
router.get("/:id", authenticate, ReportsController.getById);

/**
 * @route   GET /api/reports
 * @desc    Get all reports
 * @access  Protected
 */
router.get("/", authenticate, ReportsController.getAll);

/**
 * @route   PUT /api/reports/:id
 * @desc    Update reports
 * @access  Protected
 */
router.put("/:id", authenticate, ReportsController.update);

/**
 * @route   DELETE /api/reports/:id
 * @desc    Delete reports
 * @access  Protected
 */
router.delete("/:id", authenticate, ReportsController.delete);

export default router;
