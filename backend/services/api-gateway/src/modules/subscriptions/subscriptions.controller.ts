import { supabase } from "shared/database/supabase";
import { Response } from "express";
import { AuthRequest } from "../../common/middleware/auth";
import { SubscriptionService } from "./subscriptions.service";
import { HTTP_STATUS, ERROR_MESSAGES } from "../../constants";
import { logger } from "shared/monitoring/logger";

/**
 * Subscriptions Controller
 * Handles HTTP requests for subscriptions
 */
export class SubscriptionsController {
  static async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await SubscriptionService.addManualSubscription(userId, req.body);
      res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error) {
      logger.error("Subscriptions creation failed", error as Error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : "Operation failed",
      });
    }
  }

  static async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const { data: result } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error("Get subscriptions failed", error as Error);
      res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.GENERIC.NOT_FOUND,
        message: error instanceof Error ? error.message : "Operation failed",
      });
    }
  }

  static async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await SubscriptionService.getUserSubscriptions(userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error("Get all subscriptions failed", error as Error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
      });
    }
  }

  static async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const result = await SubscriptionService.updateSubscriptionStatus(
        id,
        userId,
        req.body.status
      );
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error("Update subscriptions failed", error as Error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
      });
    }
  }

  static async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      await SubscriptionService.cancelSubscription(id, userId);
      res.status(HTTP_STATUS.NO_CONTENT).send();
    } catch (error) {
      logger.error("Delete subscriptions failed", error as Error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
      });
    }
  }
}
