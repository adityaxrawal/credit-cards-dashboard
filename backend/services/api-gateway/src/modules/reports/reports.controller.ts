import { Request, Response, NextFunction } from "express";
import { ReportingService } from "./reports.service";
import { HTTP_STATUS, ERROR_MESSAGES } from "../../constants";
import { logger } from "shared/monitoring/logger";
import { startSpan, captureException } from "shared/monitoring/sentry";

/**
 * Reports Controller
 * Handles HTTP requests for reports
 */
export class ReportsController {
  static async create(req: Request, res: Response): Promise<void> {
    return startSpan("reports.create", "report", async () => {
      try {
        const result = await ReportingService.create(req.body);
        res.status(HTTP_STATUS.CREATED).json(result);
      } catch (error: any) {
        captureException(error, { operation: "create", userId: (req as any).user?.userId });
        logger.error("Reports creation failed:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
          message: error.message,
        });
      }
    });
  }

  static async getById(req: Request, res: Response): Promise<void> {
    return startSpan("reports.getById", "report", async () => {
      try {
        const { id } = req.params;
        const result = await ReportingService.getReportById(id);
        res.status(HTTP_STATUS.OK).json(result);
      } catch (error: any) {
        captureException(error, { operation: "getById", reportId: req.params.id });
        logger.error("Get reports failed:", error);
        res.status(HTTP_STATUS.NOT_FOUND).json({
          error: ERROR_MESSAGES.GENERIC.NOT_FOUND,
          message: error.message,
        });
      }
    });
  }

  static async getAll(req: Request, res: Response): Promise<void> {
    return startSpan("reports.getAll", "report", async () => {
      try {
        const userId = (req as any).user?.userId;
        const result = await ReportingService.getReports(userId);
        res.status(HTTP_STATUS.OK).json(result);
      } catch (error: any) {
        captureException(error, { operation: "getAll", userId: (req as any).user?.userId });
        logger.error("Get all reports failed:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        });
      }
    });
  }

  static async update(req: Request, res: Response): Promise<void> {
    return startSpan("reports.update", "report", async () => {
      try {
        const { id } = req.params;
        const result = await ReportingService.update(id, req.body);
        res.status(HTTP_STATUS.OK).json(result);
      } catch (error: any) {
        captureException(error, { operation: "update", reportId: req.params.id });
        logger.error("Update reports failed:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        });
      }
    });
  }

  static async delete(req: Request, res: Response): Promise<void> {
    return startSpan("reports.delete", "report", async () => {
      try {
        const { id } = req.params;
        await ReportingService.delete(id);
        res.status(HTTP_STATUS.NO_CONTENT).send();
      } catch (error: any) {
        captureException(error, { operation: "delete", reportId: req.params.id });
        logger.error("Delete reports failed:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        });
      }
    });
  }
}
