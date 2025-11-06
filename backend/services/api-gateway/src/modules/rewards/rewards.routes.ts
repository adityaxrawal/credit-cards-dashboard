import { Router } from "express";
import { RewardsController } from "./rewards.controller";
import { authenticate } from "@common/middleware/auth";

const router = Router();

/**
 * @route   POST /api/rewards
 * @desc    Create new rewards
 * @access  Protected
 */
router.post("/", authenticate, RewardsController.create);

/**
 * @route   GET /api/rewards/:id
 * @desc    Get rewards by ID
 * @access  Protected
 */
router.get("/:id", authenticate, RewardsController.getById);

/**
 * @route   GET /api/rewards
 * @desc    Get all rewards
 * @access  Protected
 */
router.get("/", authenticate, RewardsController.getAll);

/**
 * @route   PUT /api/rewards/:id
 * @desc    Update rewards
 * @access  Protected
 */
router.put("/:id", authenticate, RewardsController.update);

/**
 * @route   DELETE /api/rewards/:id
 * @desc    Delete rewards
 * @access  Protected
 */
router.delete("/:id", authenticate, RewardsController.delete);

export default router;
