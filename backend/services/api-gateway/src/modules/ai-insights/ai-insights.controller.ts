import { Request, Response } from "express";
import { AIInsightsService } from "./ai-insights.service";
import { HTTP_STATUS, ERROR_MESSAGES } from "../../constants";
import { logger } from "../../utils/logger";
import { AuthRequest } from "../../common/middleware/auth";

/**
 * AiInsights Controller
 * Handles HTTP requests for ai-insights
 */
export class AiInsightsController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: "User ID not found in request",
        });
        return;
      }
      const result = await AIInsightsService.generateInsights(userId);
      res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AiInsights creation failed", { error });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        message: err.message,
      });
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: "User ID not found in request",
        });
        return;
      }
      const result = await AIInsightsService.generateInsights(userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Get ai-insights failed", { error });
      res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.GENERIC.NOT_FOUND,
        message: err.message,
      });
    }
  }

  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: "User ID not found in request",
        });
        return;
      }
      const result = await AIInsightsService.generateInsights(userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: unknown) {
      logger.error("Get all ai-insights failed", { error });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
      });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: "User ID not found in request",
        });
        return;
      }
      const result = await AIInsightsService.generateInsights(userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: unknown) {
      logger.error("Update ai-insights failed", { error });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
      });
    }
  }

  static async delete(req: Request, res: Response): Promise<void> {
    try {
      res.status(HTTP_STATUS.NO_CONTENT).send();
    } catch (error: unknown) {
      logger.error("Delete ai-insights failed", { error });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
      });
    }
  }
}
