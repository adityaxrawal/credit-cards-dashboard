import { Request, Response, NextFunction } from 'express';
import * as billsService from '../services/bills.service';

/**
 * Get all bills for the authenticated user
 */
export async function getAllBills(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const bills = await billsService.getAllBills(userId);
    
    res.json({ data: bills });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single bill by ID
 */
export async function getBill(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    
    const bill = await billsService.getBillById(userId, id);
    
    if (!bill) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bill not found' } });
    }
    
    res.json({ data: bill });
  } catch (error) {
    next(error);
  }
}

/**
 * Get bills for a specific card
 */
export async function getCardBills(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { cardId } = req.params;
    
    const bills = await billsService.getCardBills(userId, cardId);
    
    res.json({ data: bills });
  } catch (error) {
    next(error);
  }
}

/**
 * Get upcoming bills
 */
export async function getUpcomingBills(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const bills = await billsService.getUpcomingBills(userId);
    
    res.json({ data: bills });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new bill
 */
export async function createBill(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { cardId, billMonth, billYear, billAmount, billDate, dueDate, paymentStatus, notes } = req.body;
    
    // Validation
    if (!cardId || billMonth === undefined || billYear === undefined || !billAmount || !billDate || !dueDate) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
        },
      });
    }
    
    const bill = await billsService.createBill({
      cardId,
      billMonth,
      billYear,
      billAmount,
      billDate: new Date(billDate),
      dueDate: new Date(dueDate),
      paymentStatus,
      notes,
    });
    
    res.status(201).json({ data: bill });
  } catch (error) {
    next(error);
  }
}

/**
 * Update a bill (payment information)
 */
export async function updateBill(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const updates = req.body;
    
    // Convert date strings to Date objects if present
    if (updates.paymentDate) {
      updates.paymentDate = new Date(updates.paymentDate);
    }
    
    const bill = await billsService.updateBill(userId, id, updates);
    
    if (!bill) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bill not found' } });
    }
    
    res.json({ data: bill });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a bill
 */
export async function deleteBill(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    
    const deleted = await billsService.deleteBill(userId, id);
    
    if (!deleted) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bill not found' } });
    }
    
    res.json({ message: 'Bill deleted successfully' });
  } catch (error) {
    next(error);
  }
}
