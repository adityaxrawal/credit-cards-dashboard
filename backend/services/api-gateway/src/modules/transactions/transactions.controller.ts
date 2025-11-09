import { Response } from "express";
import { transactionService } from "./transactions.service";
import { HTTP_STATUS, ERROR_MESSAGES } from "../../constants";
import { logger } from "shared/monitoring/logger";
import { AuthRequest } from "../../common/middleware/auth";
import { startSpan, captureException } from "shared/monitoring/sentry";

/**
 * Transactions Controller
 * Handles HTTP requests for transactions
 */
export class TransactionsController {
  static async create(req: AuthRequest, res: Response): Promise<void> {
    return startSpan("transactions.create", "transaction", async () => {
      try {
        const userId = req.userId!;
        const result = await transactionService.createTransaction(userId, req.body);
        res.status(HTTP_STATUS.CREATED).json(result);
      } catch (error: any) {
        captureException(error, { operation: "create", userId: req.userId });
        logger.error("Transactions creation failed:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
          message: error.message,
        });
      }
    });
  }

  static async getById(req: AuthRequest, res: Response): Promise<void> {
    return startSpan("transactions.getById", "transaction", async () => {
      try {
        const { id } = req.params;
        const userId = req.userId!;
        const result = await transactionService.getTransactionById(id, userId);
        res.status(HTTP_STATUS.OK).json(result);
      } catch (error: any) {
        captureException(error, {
          operation: "getById",
          transactionId: req.params.id,
          userId: req.userId,
        });
        logger.error("Get transactions failed:", error);
        res.status(HTTP_STATUS.NOT_FOUND).json({
          error: ERROR_MESSAGES.GENERIC.NOT_FOUND,
          message: error.message,
        });
      }
    });
  }

  static async getAll(req: AuthRequest, res: Response): Promise<void> {
    return startSpan("transactions.getAll", "transaction", async () => {
      try {
        const userId = req.userId!;
        const result = await transactionService.getUserTransactions(userId);
        res.status(HTTP_STATUS.OK).json(result);
      } catch (error: any) {
        captureException(error, { operation: "getAll", userId: req.userId });
        logger.error("Get all transactions failed:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        });
      }
    });
  }

  static async update(req: AuthRequest, res: Response): Promise<void> {
    return startSpan("transactions.update", "transaction", async () => {
      try {
        const { id } = req.params;
        const userId = req.userId!;
        const result = await transactionService.updateTransaction(id, userId, req.body);
        res.status(HTTP_STATUS.OK).json(result);
      } catch (error: any) {
        captureException(error, {
          operation: "update",
          transactionId: req.params.id,
          userId: req.userId,
        });
        logger.error("Update transactions failed:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        });
      }
    });
  }

  static async delete(req: AuthRequest, res: Response): Promise<void> {
    return startSpan("transactions.delete", "transaction", async () => {
      try {
        const { id } = req.params;
        const userId = req.userId!;
        await transactionService.deleteTransaction(id, userId);
        res.status(HTTP_STATUS.NO_CONTENT).send();
      } catch (error: any) {
        captureException(error, {
          operation: "delete",
          transactionId: req.params.id,
          userId: req.userId,
        });
        logger.error("Delete transactions failed:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        });
      }
    });
  }
}
