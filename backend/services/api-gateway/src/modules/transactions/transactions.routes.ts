import { Router } from "express";
import { TransactionsController } from "./transactions.controller";
import { authenticate } from "@common/middleware/auth";

const router = Router();

/**
 * @route   POST /api/transactions
 * @desc    Create new transactions
 * @access  Protected
 */
router.post("/", authenticate, TransactionsController.create);

/**
 * @route   GET /api/transactions/:id
 * @desc    Get transactions by ID
 * @access  Protected
 */
router.get("/:id", authenticate, TransactionsController.getById);

/**
 * @route   GET /api/transactions
 * @desc    Get all transactions
 * @access  Protected
 */
router.get("/", authenticate, TransactionsController.getAll);

/**
 * @route   PUT /api/transactions/:id
 * @desc    Update transactions
 * @access  Protected
 */
router.put("/:id", authenticate, TransactionsController.update);

/**
 * @route   DELETE /api/transactions/:id
 * @desc    Delete transactions
 * @access  Protected
 */
router.delete("/:id", authenticate, TransactionsController.delete);

export default router;
