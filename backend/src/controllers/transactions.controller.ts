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
      from: req.query.from as string,
      to: req.query.to as string,
      billMonth: req.query.billMonth ? parseInt(req.query.billMonth as string) : undefined,
      billYear: req.query.billYear ? parseInt(req.query.billYear as string) : undefined,
      category: req.query.category as string,
      transactionType: req.query.transactionType as string,
      merchant: req.query.merchant as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
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
    const { cardId, transactionDate, merchant, category, amount, transactionType, description } = req.body;
    
    // Validation
    if (!cardId || !transactionDate || !merchant || !category || !amount || !transactionType) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
        },
      });
    }
    
    const transaction = await transactionsService.createManualTransaction({
      userId,
      cardId,
      transactionDate: new Date(transactionDate),
      merchant,
      category,
      amount: parseFloat(amount),
      transactionType,
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
