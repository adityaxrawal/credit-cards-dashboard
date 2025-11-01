import { Router, Response } from "express";
import { CardService } from "../services/card.service";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const cardService = new CardService();

// All card routes require authentication
router.use(authenticate);

/**
 * GET /api/cards
 * Get all cards for the authenticated user
 */
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const includeInactive = req.query.includeInactive === "true";
    const cards = await cardService.getUserCards(req.userId, includeInactive);

    res.json({
      success: true,
      data: { cards },
    });
  } catch (error: unknown) {
    console.error("Get cards error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch cards";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/cards/:id
 * Get a single card by ID
 */
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const card = await cardService.getCardById(req.params.id, req.userId);

    res.json({
      success: true,
      data: { card },
    });
  } catch (error: unknown) {
    console.error("Get card error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch card";
    const statusCode = message.includes("not found") ? 404 : 500;
    res.status(statusCode).json({ error: message });
  }
});

/**
 * GET /api/cards/:id/statistics
 * Get card statistics including spending and utilization
 */
router.get("/:id/statistics", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const statistics = await cardService.getCardStatistics(
      req.params.id,
      req.userId
    );

    res.json({
      success: true,
      data: { statistics },
    });
  } catch (error: unknown) {
    console.error("Get card statistics error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch card statistics";
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/cards
 * Create a new card
 */
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const card = await cardService.createCard(req.userId, req.body);

    res.status(201).json({
      success: true,
      data: { card },
      message: "Card created successfully",
    });
  } catch (error: unknown) {
    console.error("Create card error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create card";
    const statusCode = message.includes("already exists") ? 409 : 400;
    res.status(statusCode).json({ error: message });
  }
});

/**
 * PUT /api/cards/:id
 * Update an existing card
 */
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const card = await cardService.updateCard(
      req.params.id,
      req.userId,
      req.body
    );

    res.json({
      success: true,
      data: { card },
      message: "Card updated successfully",
    });
  } catch (error: unknown) {
    console.error("Update card error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update card";
    const statusCode = message.includes("not found") ? 404 : 400;
    res.status(statusCode).json({ error: message });
  }
});

/**
 * DELETE /api/cards/:id
 * Delete a card (soft delete)
 */
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    await cardService.deleteCard(req.params.id, req.userId);

    res.json({
      success: true,
      message: "Card deleted successfully",
    });
  } catch (error: unknown) {
    console.error("Delete card error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete card";
    const statusCode = message.includes("not found") ? 404 : 500;
    res.status(statusCode).json({ error: message });
  }
});

export default router;
