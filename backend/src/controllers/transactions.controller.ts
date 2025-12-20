import { Request, Response, NextFunction } from 'express';
import * as transactionsService from '../services/transactions.service';

/**
 * Get all transactions with filters
 */
export async function getTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
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
export async function getTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
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
export async function createTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const {
      instrumentType,
      instrumentId,
      cardId, // Legacy support
      transactionDate,
      merchant,
      category,
      amount,
      transactionType,
      direction,
      description
    } = req.body;

    // Validation
    if ((!instrumentType && !cardId) || !transactionDate || !merchant || !category || !amount || !transactionType) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
        },
      });
    }

    const transaction = await transactionsService.createManualTransaction({
      userId,
      instrumentType: instrumentType || 'credit_card',
      instrumentId: instrumentId || cardId,
      transactionDate: new Date(transactionDate),
      merchant,
      category,
      amount: parseFloat(amount),
      transactionType,
      direction: direction || (transactionType === 'debit' ? 'debit' : 'credit'),
      description,
    });

    res.status(201).json({ data: transaction });
  } catch (error) {
    next(error);
  }
}

/**
 * Update a transaction
 */
export async function updateTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const updates = req.body;

    const transaction = await transactionsService.updateTransaction(userId, id, updates);

    if (!transaction) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
    }

    res.json({ data: transaction });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
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
export async function getTransactionsByType(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
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
export async function getTransactionsByInstrument(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
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
export async function getPendingReviewQueue(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
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
export async function manuallyClassifyTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
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
