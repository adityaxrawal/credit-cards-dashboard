import express from "express";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../utils/logger";

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Get pending manual review items
 * GET /review/pending
 */
router.get("/pending", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data, error } = await supabase
      .from("manual_review_queue")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ items: data || [] });
  } catch (error) {
    logger.error({ error }, "Failed to fetch pending reviews");
    res.status(500).json({ error: "Failed to fetch pending reviews" });
  }
});

/**
 * Get single review item
 * GET /review/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const { data, error } = await supabase
      .from("manual_review_queue")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Review item not found" });
    }

    res.json(data);
  } catch (error) {
    logger.error({ error }, "Failed to fetch review item");
    res.status(500).json({ error: "Failed to fetch review item" });
  }
});

/**
 * Approve transaction
 * PUT /review/:id/approve
 */
router.put("/:id/approve", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { editedTransaction } = req.body;

    // Get review item
    const { data: reviewItem, error: fetchError } = await supabase
      .from("manual_review_queue")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !reviewItem) {
      return res.status(404).json({ error: "Review item not found" });
    }

    // Create transaction (simplified - would map to actual transaction schema)
    const transaction = editedTransaction || reviewItem.extracted_data;

    // Update review status
    const { error: updateError } = await supabase
      .from("manual_review_queue")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        final_data: transaction,
      })
      .eq("id", id);

    if (updateError) throw updateError;

    logger.info({ reviewId: id, userId }, "Transaction approved");

    res.json({ success: true, transaction });
  } catch (error) {
    logger.error({ error }, "Failed to approve transaction");
    res.status(500).json({ error: "Failed to approve transaction" });
  }
});

/**
 * Reject transaction
 * PUT /review/:id/reject
 */
router.put("/:id/reject", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { reason } = req.body;

    const { error } = await supabase
      .from("manual_review_queue")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;

    logger.info({ reviewId: id, userId, reason }, "Transaction rejected");

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Failed to reject transaction");
    res.status(500).json({ error: "Failed to reject transaction" });
  }
});

/**
 * Get review statistics
 * GET /review/stats
 */
router.get("/stats", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data, error } = await supabase
      .from("manual_review_queue")
      .select("status")
      .eq("user_id", userId);

    if (error) throw error;

    const stats = {
      pending: data?.filter((r) => r.status === "pending").length || 0,
      approved: data?.filter((r) => r.status === "approved").length || 0,
      rejected: data?.filter((r) => r.status === "rejected").length || 0,
      total: data?.length || 0,
    };

    res.json(stats);
  } catch (error) {
    logger.error({ error }, "Failed to fetch review stats");
    res.status(500).json({ error: "Failed to fetch review stats" });
  }
});

export default router;
