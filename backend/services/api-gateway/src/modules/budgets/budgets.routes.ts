import { Router } from "express";
import { BudgetsController } from "./budgets.controller";
import { authenticate } from "@common/middleware/auth";

const router = Router();

/**
 * @route   POST /api/budgets
 * @desc    Create new budgets
 * @access  Protected
 */
router.post("/", authenticate, BudgetsController.create);

/**
 * @route   GET /api/budgets/:id
 * @desc    Get budgets by ID
 * @access  Protected
 */
router.get("/:id", authenticate, BudgetsController.getById);

/**
 * @route   GET /api/budgets
 * @desc    Get all budgets
 * @access  Protected
 */
router.get("/", authenticate, BudgetsController.getAll);

/**
 * @route   PUT /api/budgets/:id
 * @desc    Update budgets
 * @access  Protected
 */
router.put("/:id", authenticate, BudgetsController.update);

/**
 * @route   DELETE /api/budgets/:id
 * @desc    Delete budgets
 * @access  Protected
 */
router.delete("/:id", authenticate, BudgetsController.delete);

export default router;
