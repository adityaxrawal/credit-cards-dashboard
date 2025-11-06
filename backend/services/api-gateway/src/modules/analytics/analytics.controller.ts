import { Request, Response, NextFunction } from "express";
import { advancedAnalyticsService } from "./analytics.service";
import { HTTP_STATUS, ERROR_MESSAGES } from "../../constants";
import { logger } from "../../utils/logger";

/**
 * Analytics Controller
 * Handles HTTP requests for analytics
 */
export class AnalyticsController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await AnalyticsService.create(req.body);
      res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error: any) {
      logger.error("Analytics creation failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        message: error.message
      });
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await AnalyticsService.getAnalyticById(id);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: any) {
      logger.error("Get analytics failed:", error);
      res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.GENERIC.NOT_FOUND,
        message: error.message
      });
    }
  }

  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const result = await AnalyticsService.getAnalytics(userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: any) {
      logger.error("Get all analytics failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR
      });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await AnalyticsService.update(id, req.body);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: any) {
      logger.error("Update analytics failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR
      });
    }
  }

  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await AnalyticsService.delete(id);
      res.status(HTTP_STATUS.NO_CONTENT).send();
    } catch (error: any) {
      logger.error("Delete analytics failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR
      });
    }
  }
}
