import { Response } from "express";
import { AuthRequest } from "../../common/middleware/auth";
import { cardService } from "./cards.service";
import { HTTP_STATUS, ERROR_MESSAGES } from "../../constants";
import { logger } from "shared/monitoring/logger";

/**
 * Cards Controller
 * Handles HTTP requests for cards
 */
export class CardsController {
  static async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await cardService.createCard(userId, req.body);
      res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error) {
      logger.error("Cards creation failed", error as Error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : "Operation failed"
      });
    }
  }

  static async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const result = await cardService.getCardById(id, userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error("Get cards failed", error as Error);
      res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.GENERIC.NOT_FOUND,
        message: error instanceof Error ? error.message : "Operation failed"
      });
    }
  }

  static async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await cardService.getUserCards(userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error("Get all cards failed", error as Error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR
      });
    }
  }

  static async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const result = await cardService.updateCard(id, userId, req.body);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error("Update cards failed", error as Error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR
      });
    }
  }

  static async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      await cardService.deleteCard(id, userId);
      res.status(HTTP_STATUS.NO_CONTENT).send();
    } catch (error) {
      logger.error("Delete cards failed", error as Error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR
      });
    }
  }
}
