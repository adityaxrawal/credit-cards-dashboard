/**
 * Transactions Controller
 * 
 * Handles transaction CRUD operations.
 * Uses factory pattern for dependency injection.
 * 
 * Part of Issue #12: Controller-Service Dependency Injection
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '@shared/types/auth.types';
import { CreateTransactionSchema, UpdateTransactionSchema } from './validators/transaction.schema';

import logger from '@shared/utils/infrastructure/logger';
import { Transaction, TransactionFilters, TransactionMetadata } from '@shared/types/transaction.types';
import { TimezoneService } from '@shared/utils/helpers/TimezoneService';

/**
 * Transaction Service Interface (inline for this controller)
 */
export interface ITransactionServiceMethods {
  listTransactions(userId: string, filters: TransactionFilters): Promise<{
    data: Transaction[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    aggregations: any;
  }>;
  getTransaction(userId: string, id: string): Promise<Transaction | null>;
  createManualTransaction(data: {
    userId: string;
    instrumentType: string;
    instrumentId: string;
    transactionDate: Date;
    merchant: string;
    category: string;
    amount: number;
    transactionType: string;
    direction: 'credit' | 'debit';
    description?: string;
    metadata?: TransactionMetadata;
    parentTransactionId?: string;
  }): Promise<Transaction>;
  updateTransaction(userId: string, id: string, updates: Partial<Transaction>): Promise<Transaction | null>;
  deleteTransaction(userId: string, id: string): Promise<boolean>;
  bulkUpdateTransactions(userId: string, ids: string[], updates: Partial<Transaction>): Promise<{ updated: number, failed: number }>;
  bulkDeleteTransactions(userId: string, ids: string[]): Promise<{ deleted: number, failed: number }>;
  resolveDuplicate(userId: string, keepId: string, duplicateId: string): Promise<boolean>;
}

/**
 * Controller interface
 */
export interface ITransactionsController {
  getTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
  getTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
  createTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
  updateTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
  deleteTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
  getTransactionsByType(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
  getTransactionsByInstrument(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
  getPendingReviewQueue(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
  manuallyClassifyTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
  bulkUpdateTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
  bulkDeleteTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
  mergeTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
}

/**
 * Factory function to create Transactions controller with injected dependencies
 */
export function createTransactionsController(
  transactionsService: ITransactionServiceMethods
): ITransactionsController {
  return {
    async getTransactions(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const userTimezone = await TimezoneService.getUserTimezone(userId);

        // Date handling logic:
        // 1. If dates provided in query, assume they are in User Timezone and convert to UTC
        // 2. If not provided, default to Last 3 Months (in User Timezone) converted to UTC

        let fromDate: Date | undefined;
        let toDate: Date | undefined;

        if (req.query.from) {
          fromDate = TimezoneService.userDateToUTC(req.query.from as string, userTimezone);
        } else {
          // Default: 3 months ago relative to user's "now"
          fromDate = TimezoneService.getRelativeDateInUTC(3, 'month', userTimezone);
        }

        if (req.query.to) {
          // For 'to' date, we usually want the end of that day to include all transactions
          toDate = TimezoneService.userDateToUTC(req.query.to as string, userTimezone, true);
        } else {
          // Default: Now (which is end of current lookup window)
          toDate = TimezoneService.getNowInUTC(userTimezone);
        }

        const filters = {
          cardId: req.query.cardId as string,
          instrumentType: req.query.instrumentType as string,
          instrumentId: req.query.instrumentId as string,
          direction: req.query.direction as string,
          from: fromDate,
          to: toDate,
          billMonth: req.query.billMonth ? parseInt(req.query.billMonth as string) : undefined,
          billYear: req.query.billYear ? parseInt(req.query.billYear as string) : undefined, // Check param name
          category: req.query.category as string,
          transactionType: req.query.transactionType as string,
          merchant: req.query.merchant as string,
          needsReview: req.query.needsReview === 'true' ? true : undefined,
          page: req.query.page ? parseInt(req.query.page as string) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
          sortBy: req.query.sortBy as string,
          sortOrder: req.query.sortOrder as 'asc' | 'desc',
          search: req.query.search as string,
        };
        const result = await transactionsService.listTransactions(userId, filters);

        // Convert transaction dates to user's timezone
        const dataWithTimezone = TimezoneService.convertTransactionsBatch(result.data, userTimezone);

        res.json({
          ...result,
          data: dataWithTimezone,
          timezone: userTimezone,
          filter_dates: {
            from: fromDate.toISOString(),
            to: toDate.toISOString()
          }
        });
      } catch (error) {
        next(error);
      }
    },

    async getTransaction(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { id } = req.params;
        const transaction = await transactionsService.getTransaction(userId, id);
        if (!transaction) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } }) as any;
        }

        // Convert transaction dates to user's timezone
        const userTimezone = await TimezoneService.getUserTimezone(userId);
        const transactionWithTimezone = TimezoneService.convertTransactionDates(transaction, userTimezone);

        res.json({ data: transactionWithTimezone, timezone: userTimezone });
      } catch (error) {
        next(error);
      }
    },

    async createTransaction(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        logger.info(`[TransactionController] Create transaction request from user ${userId}`, { body: req.body });
        const validatedData = CreateTransactionSchema.parse(req.body);

        const transaction = await transactionsService.createManualTransaction({
          userId,
          instrumentType: validatedData.instrumentType || 'credit_card',
          instrumentId: (validatedData.instrumentId || validatedData.cardId)!,
          transactionDate: new Date(validatedData.transactionDate || validatedData.date!),
          merchant: validatedData.merchant,
          category: validatedData.category,
          amount: validatedData.amount,
          transactionType: validatedData.transactionType,
          direction: validatedData.direction || (validatedData.transactionType === 'debit' ? 'debit' : 'credit'),
          description: validatedData.description,
          parentTransactionId: validatedData.parentTransactionId
        });

        res.status(201).json({ data: transaction });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(422).json({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.errors }
          });
        }
        next(error);
      }
    },

    async updateTransaction(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { id } = req.params;
        logger.info(`[TransactionController] Update transaction request from user ${userId}, id ${id}`, { body: req.body });
        const updates = await UpdateTransactionSchema.parseAsync(req.body);
        const transaction = await transactionsService.updateTransaction(userId, id, updates);
        if (!transaction) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } }) as any;
        }
        res.json({ data: transaction });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(422).json({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid update data', details: error.errors }
          });
        }
        next(error);
      }
    },

    async deleteTransaction(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { id } = req.params;
        const deleted = await transactionsService.deleteTransaction(userId, id);
        if (!deleted) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
        }
        res.json({ message: 'Transaction deleted successfully' });
      } catch (error) {
        next(error);
      }
    },

    async getTransactionsByType(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { type } = req.params;
        const { page, limit } = req.query;
        const result = await transactionsService.listTransactions(userId, {
          transactionType: type,
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 50,
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    },

    async getTransactionsByInstrument(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { instrumentId } = req.params;
        const { page, limit } = req.query;
        const result = await transactionsService.listTransactions(userId, {
          instrumentId,
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 50,
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    },

    async getPendingReviewQueue(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { page, limit } = req.query;
        const result = await transactionsService.listTransactions(userId, {
          needsReview: true,
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 50,
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    },

    async manuallyClassifyTransaction(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { id } = req.params;
        const { transactionType, category, description } = req.body;
        const transaction = await transactionsService.updateTransaction(userId, id, {
          transaction_type: transactionType,
          category,
          description,
          needs_review: false,
          classification_method: 'manual'
        });
        if (!transaction) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
        }
        res.json({ data: transaction });
      } catch (error) {
        next(error);
      }
    },

    async bulkUpdateTransactions(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { transactionIds, updates } = req.body;

        if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
          return res.status(400).json({
            error: { code: 'VALIDATION_ERROR', message: 'transactionIds must be a non-empty array' }
          });
        }
        if (transactionIds.length > 100) {
          return res.status(400).json({
            error: { code: 'VALIDATION_ERROR', message: 'Cannot update more than 100 transactions at once' }
          });
        }

        const result = await transactionsService.bulkUpdateTransactions(userId, transactionIds, updates);
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },

    async bulkDeleteTransactions(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { transactionIds } = req.body;

        if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
          return res.status(400).json({
            error: { code: 'VALIDATION_ERROR', message: 'transactionIds must be a non-empty array' }
          });
        }
        if (transactionIds.length > 100) {
          return res.status(400).json({
            error: { code: 'VALIDATION_ERROR', message: 'Cannot delete more than 100 transactions at once' }
          });
        }

        const result = await transactionsService.bulkDeleteTransactions(userId, transactionIds);
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },

    async mergeTransactions(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { keepTransactionId, duplicateTransactionId } = req.body;

        if (!keepTransactionId || !duplicateTransactionId) {
          return res.status(400).json({
            error: { code: 'VALIDATION_ERROR', message: 'keepTransactionId and duplicateTransactionId are required' }
          });
        }

        await transactionsService.resolveDuplicate(userId, keepTransactionId, duplicateTransactionId);
        res.json({ success: true, message: 'Transactions merged successfully' });
      } catch (error) {
        next(error);
      }
    },
  };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import * as transactionsService from './services/TransactionService';

const defaultController = createTransactionsController(transactionsService as unknown as ITransactionServiceMethods);

export const getTransactions = defaultController.getTransactions;
export const getTransaction = defaultController.getTransaction;
export const createTransaction = defaultController.createTransaction;
export const updateTransaction = defaultController.updateTransaction;
export const deleteTransaction = defaultController.deleteTransaction;
export const getTransactionsByType = defaultController.getTransactionsByType;
export const getTransactionsByInstrument = defaultController.getTransactionsByInstrument;
export const getPendingReviewQueue = defaultController.getPendingReviewQueue;
export const manuallyClassifyTransaction = defaultController.manuallyClassifyTransaction;
export const bulkUpdateTransactions = defaultController.bulkUpdateTransactions;
export const bulkDeleteTransactions = defaultController.bulkDeleteTransactions;
export const mergeTransactions = defaultController.mergeTransactions;
