import { Router } from "express";
import { CardsController } from "./cards.controller";
import { authenticate } from "@common/middleware/auth";

const router = Router();

/**
 * @route   POST /api/cards
 * @desc    Create new cards
 * @access  Protected
 */
router.post("/", authenticate, CardsController.create);

/**
 * @route   GET /api/cards/:id
 * @desc    Get cards by ID
 * @access  Protected
 */
router.get("/:id", authenticate, CardsController.getById);

/**
 * @route   GET /api/cards
 * @desc    Get all cards
 * @access  Protected
 */
router.get("/", authenticate, CardsController.getAll);

/**
 * @route   PUT /api/cards/:id
 * @desc    Update cards
 * @access  Protected
 */
router.put("/:id", authenticate, CardsController.update);

/**
 * @route   DELETE /api/cards/:id
 * @desc    Delete cards
 * @access  Protected
 */
router.delete("/:id", authenticate, CardsController.delete);

export default router;
