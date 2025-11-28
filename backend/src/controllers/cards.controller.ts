import { Request, Response, NextFunction } from 'express';
import * as cardsService from '../services/cards.service';

/**
 * Get all cards for the authenticated user
 */
export async function getAllCards(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const cards = await cardsService.getAllCards(userId);
    
    res.json({ data: cards });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single card
 */
export async function getCard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    
    const card = await cardsService.getCardDetails(userId, id);
    
    if (!card) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Card not found' } });
    }
    
    res.json({ data: card });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new card
 */
export async function createCard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { cardName, bankName, lastFour, billDate, dueDate, creditLimit, activationDate, notes } = req.body;
    
    // Validation
    if (!cardName || !bankName || !lastFour || !billDate || !dueDate || !creditLimit) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
        },
      });
    }
    
    const card = await cardsService.createCard({
      userId,
      cardName,
      bankName,
      lastFour,
      billDate,
      dueDate,
      creditLimit,
      activationDate: activationDate ? new Date(activationDate) : undefined,
      notes,
    });
    
    res.status(201).json({ data: card });
  } catch (error) {
    next(error);
  }
}

/**
 * Update a card
 */
export async function updateCard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const updates = req.body;
    
    const card = await cardsService.updateCard(userId, id, updates);
    
    if (!card) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Card not found' } });
    }
    
    res.json({ data: card });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a card
 */
export async function deleteCard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    
    const deleted = await cardsService.deleteCard(userId, id);
    
    if (!deleted) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Card not found' } });
    }
    
    res.json({ message: 'Card deleted successfully' });
  } catch (error) {
    next(error);
  }
}

/**
 * Get card statement for a billing cycle
 */
export async function getCardStatement(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Month and year are required',
        },
      });
    }
    
    const statement = await cardsService.getCardStatement(
      userId,
      id,
      parseInt(month as string),
      parseInt(year as string)
    );
    
    if (!statement) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Card not found' } });
    }
    
    res.json({ data: statement });
  } catch (error) {
    next(error);
  }
}
