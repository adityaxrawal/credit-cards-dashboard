import { Router } from "express";
import { SubscriptionsController } from "./subscriptions.controller";
import { authenticate } from "@common/middleware/auth";

const router = Router();

/**
 * @route   POST /api/subscriptions
 * @desc    Create new subscriptions
 * @access  Protected
 */
router.post("/", authenticate, SubscriptionsController.create);

/**
 * @route   GET /api/subscriptions/:id
 * @desc    Get subscriptions by ID
 * @access  Protected
 */
router.get("/:id", authenticate, SubscriptionsController.getById);

/**
 * @route   GET /api/subscriptions
 * @desc    Get all subscriptions
 * @access  Protected
 */
router.get("/", authenticate, SubscriptionsController.getAll);

/**
 * @route   PUT /api/subscriptions/:id
 * @desc    Update subscriptions
 * @access  Protected
 */
router.put("/:id", authenticate, SubscriptionsController.update);

/**
 * @route   DELETE /api/subscriptions/:id
 * @desc    Delete subscriptions
 * @access  Protected
 */
router.delete("/:id", authenticate, SubscriptionsController.delete);

export default router;
