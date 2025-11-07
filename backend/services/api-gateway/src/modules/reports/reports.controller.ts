import { Request, Response, NextFunction } from "express";
import { ReportingService } from "./reports.service";
import { HTTP_STATUS, ERROR_MESSAGES } from "../../constants";
import { logger } from "shared/monitoring/logger";

/**
 * Reports Controller
 * Handles HTTP requests for reports
 */
export class ReportsController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await ReportingService.create(req.body);
      res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error: any) {
      logger.error("Reports creation failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        message: error.message
      });
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await ReportingService.getReportById(id);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: any) {
      logger.error("Get reports failed:", error);
      res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.GENERIC.NOT_FOUND,
        message: error.message
      });
    }
  }

  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const result = await ReportingService.getReports(userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: any) {
      logger.error("Get all reports failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR
      });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await ReportingService.update(id, req.body);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: any) {
      logger.error("Update reports failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR
      });
    }
  }

  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await ReportingService.delete(id);
      res.status(HTTP_STATUS.NO_CONTENT).send();
    } catch (error: any) {
      logger.error("Delete reports failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR
      });
    }
  }
}
