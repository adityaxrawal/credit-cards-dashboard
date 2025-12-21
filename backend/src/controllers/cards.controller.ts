import { AuthRequest } from '../types/auth.types';


import { Request, Response, NextFunction } from 'express';
import * as cardsService from '../services/cards/CardsService';
import { z } from 'zod';
import { CreateCardSchema, UpdateCardSchema } from '../validators/other.schema';

/**
 * Get all cards for the authenticated user
 */
export async function getAllCards(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const cards = await cardsService.getAllCards(userId);

    res.json({ data: cards });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single card
 */
export async function getCard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
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
export async function createCard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    // Zod Validation
    const validatedData = await CreateCardSchema.parseAsync(req.body);

    const card = await cardsService.createCard({
      userId,
      cardName: validatedData.cardName,
      bankName: validatedData.bankName,
      lastFour: validatedData.lastFour,
      billDate: validatedData.billDate,
      dueDate: validatedData.dueDate,
      creditLimit: validatedData.creditLimit,
      activationDate: validatedData.activationDate ? new Date(validatedData.activationDate) : undefined,
      notes: validatedData.notes,
    });

    res.status(201).json({ data: card });
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
 * Update a card
 */
export async function updateCard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updates = await UpdateCardSchema.parseAsync(req.body);

    const card = await cardsService.updateCard(userId, id, updates);

    if (!card) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Card not found' } });
    }

    res.json({ data: card });
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
 * Delete a card
 */
export async function deleteCard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
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
export async function getCardStatement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
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
