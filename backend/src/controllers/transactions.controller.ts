import { Response, NextFunction } from 'express';
import { z } from 'zod';
import * as transactionsService from '../services/transactions/TransactionService';
import { AuthRequest } from '../types/auth.types';

import { CreateTransactionSchema, UpdateTransactionSchema } from '../validators/transaction.schema';

/**
 * Get all transactions with filters
 */
export async function getTransactions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const filters = {
      cardId: req.query.cardId as string,
      instrumentType: req.query.instrumentType as string,
      instrumentId: req.query.instrumentId as string,
      direction: req.query.direction as string,
      from: req.query.from as string,
      to: req.query.to as string,
      billMonth: req.query.billMonth ? parseInt(req.query.billMonth as string) : undefined,
      billYear: req.query.billYear ? parseInt(req.query.billYear as string) : undefined,
      category: req.query.category as string,
      transactionType: req.query.transactionType as string,
      merchant: req.query.merchant as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as 'asc' | 'desc',
      search: req.query.search as string,
    };

    const result = await transactionsService.listTransactions(userId, filters);

    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single transaction
 */
export async function getTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const transaction = await transactionsService.getTransaction(userId, id);

    if (!transaction) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
    }

    res.json({ data: transaction });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a manual transaction
 */
export async function createTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    console.log(`[TransactionController] Create transaction request from user ${userId}`, req.body);
    // Zod Validation
    const validatedData = await CreateTransactionSchema.parseAsync(req.body);

    const transaction = await transactionsService.createManualTransaction({
      userId,
      instrumentType: validatedData.instrumentType || 'credit_card',
      instrumentId: (validatedData.instrumentId || validatedData.cardId)!, // Validated by Zod refine
      transactionDate: new Date(validatedData.transactionDate || validatedData.date!),
      merchant: validatedData.merchant,
      category: validatedData.category,
      amount: validatedData.amount,
      transactionType: validatedData.transactionType,
      direction: validatedData.direction || (validatedData.transactionType === 'debit' ? 'debit' : 'credit'),
      description: validatedData.description,
    });

    res.status(201).json({ data: transaction });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors
        }
      });
    }
    next(error);
  }
}

/**
 * Update a transaction
 */
export async function updateTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    console.log(`[TransactionController] Update transaction request from user ${userId}, id ${id}`, req.body);
    const updates = await UpdateTransactionSchema.parseAsync(req.body);

    const transaction = await transactionsService.updateTransaction(userId, id, updates);

    if (!transaction) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
    }

    res.json({ data: transaction });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid update data',
          details: error.errors
        }
      });
    }
    next(error);
  }
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(req: AuthRequest, res: Response, next: NextFunction) {
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
}

/**
 * Get transactions by type
 */
export async function getTransactionsByType(req: AuthRequest, res: Response, next: NextFunction) {
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
}

/**
 * Get transactions by instrument
 */
export async function getTransactionsByInstrument(req: AuthRequest, res: Response, next: NextFunction) {
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
}

/**
 * Get pending review queue
 */
export async function getPendingReviewQueue(req: AuthRequest, res: Response, next: NextFunction) {
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
}

/**
 * Manually classify a transaction
 */
export async function manuallyClassifyTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { transactionType, category, description } = req.body;

    const transaction = await transactionsService.updateTransaction(userId, id, {
      transactionType,
      category,
      description,
      needsReview: false, // Clearing flags since it's manual
      classificationMethod: 'manual'
    } as any);

    if (!transaction) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
    }

    res.json({ data: transaction });
  } catch (error) {
    next(error);
  }
}
