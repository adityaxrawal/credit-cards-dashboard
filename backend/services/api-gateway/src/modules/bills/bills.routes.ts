import { Router } from "express";
import { BillsController } from "./bills.controller";
import { authenticate } from "@common/middleware/auth";

const router = Router();

/**
 * @route   POST /api/bills
 * @desc    Create new bills
 * @access  Protected
 */
router.post("/", authenticate, BillsController.create);

/**
 * @route   GET /api/bills/:id
 * @desc    Get bills by ID
 * @access  Protected
 */
router.get("/:id", authenticate, BillsController.getById);

/**
 * @route   GET /api/bills
 * @desc    Get all bills
 * @access  Protected
 */
router.get("/", authenticate, BillsController.getAll);

/**
 * @route   PUT /api/bills/:id
 * @desc    Update bills
 * @access  Protected
 */
router.put("/:id", authenticate, BillsController.update);

/**
 * @route   DELETE /api/bills/:id
 * @desc    Delete bills
 * @access  Protected
 */
router.delete("/:id", authenticate, BillsController.delete);

export default router;
