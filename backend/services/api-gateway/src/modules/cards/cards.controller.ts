import { Request, Response } from "express";
import { cardService } from "./cards.service";
import { HTTP_STATUS, ERROR_MESSAGES } from "../../constants";
import { logger } from "../../utils/logger";

/**
 * Cards Controller
 * Handles HTTP requests for cards
 */
export class CardsController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const result = await cardService.addCard(userId, req.body);
      res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error: any) {
      logger.error("Cards creation failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        message: error.message
      });
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      const result = await cardService.getCardById(id, userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: any) {
      logger.error("Get cards failed:", error);
      res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.GENERIC.NOT_FOUND,
        message: error.message
      });
    }
  }

  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const result = await cardService.getUserCards(userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: any) {
      logger.error("Get all cards failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR
      });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      const result = await cardService.updateCard(id, userId, req.body);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: any) {
      logger.error("Update cards failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR
      });
    }
  }

  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      await cardService.deleteCard(id, userId);
      res.status(HTTP_STATUS.NO_CONTENT).send();
    } catch (error: any) {
      logger.error("Delete cards failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR
      });
    }
  }
}
