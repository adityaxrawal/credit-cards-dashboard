import { Request, Response, NextFunction } from "express";
import { rewardsService } from "./rewards.service";
import { HTTP_STATUS, ERROR_MESSAGES } from "../../constants";
import { logger } from "../../utils/logger";

/**
 * Rewards Controller
 * Handles HTTP requests for rewards
 */
export class RewardsController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await rewardsService.create(req.body);
      res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error: any) {
      logger.error("Rewards creation failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        message: error.message
      });
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await rewardsService.getRewardById(id);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: any) {
      logger.error("Get rewards failed:", error);
      res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.GENERIC.NOT_FOUND,
        message: error.message
      });
    }
  }

  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const result = await rewardsService.getRewards(userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: any) {
      logger.error("Get all rewards failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR
      });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await rewardsService.update(id, req.body);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: any) {
      logger.error("Update rewards failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR
      });
    }
  }

  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await rewardsService.delete(id);
      res.status(HTTP_STATUS.NO_CONTENT).send();
    } catch (error: any) {
      logger.error("Delete rewards failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR
      });
    }
  }
}
