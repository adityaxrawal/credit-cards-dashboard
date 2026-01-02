/**
 * Cards Controller
 * 
 * Handles credit card CRUD operations.
 * Uses factory pattern for dependency injection.
 * 
 * Part of Issue #12: Controller-Service Dependency Injection
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '@shared/types/auth.types';
import { CreateCardSchema, UpdateCardSchema } from '@shared/utils/validation/other.schema';

/**
 * Cards Service Interface
 */
export interface ICardsService {
  getAllCards(userId: string): Promise<any>;
  getCardDetails(userId: string, cardId: string): Promise<any>;
  createCard(data: any): Promise<any>;
  updateCard(userId: string, cardId: string, updates: any): Promise<any>;
  deleteCard(userId: string, cardId: string): Promise<boolean>;
  getCardStatement(userId: string, cardId: string, month: number, year: number): Promise<any>;
}

/**
 * Controller Interface
 */
export interface ICardsController {
  getAllCards(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  getCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  createCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  updateCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  deleteCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  getCardStatement(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

/**
 * Factory function to create Cards controller with injected dependencies
 */
export function createCardsController(cardsService: ICardsService): ICardsController {
  return {
    async getAllCards(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const cards = await cardsService.getAllCards(userId);
        res.json({ data: cards });
      } catch (error) {
        next(error);
      }
    },

    async getCard(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { id } = req.params;
        const card = await cardsService.getCardDetails(userId, id);
        if (!card) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Card not found' } }) as any;
        }
        res.json({ data: card });
      } catch (error) {
        next(error);
      }
    },

    async createCard(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
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
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.errors }
          }) as any;
        }
        next(error);
      }
    },

    async updateCard(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { id } = req.params;
        const updates = await UpdateCardSchema.parseAsync(req.body);
        const card = await cardsService.updateCard(userId, id, updates);
        if (!card) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Card not found' } }) as any;
        }
        res.json({ data: card });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(422).json({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid update data', details: error.errors }
          }) as any;
        }
        next(error);
      }
    },

    async deleteCard(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { id } = req.params;
        const deleted = await cardsService.deleteCard(userId, id);
        if (!deleted) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Card not found' } }) as any;
        }
        res.json({ message: 'Card deleted successfully' });
      } catch (error) {
        next(error);
      }
    },

    async getCardStatement(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { id } = req.params;
        const { month, year } = req.query;

        if (!month || !year) {
          return res.status(400).json({
            error: { code: 'VALIDATION_ERROR', message: 'Month and year are required' }
          }) as any;
        }

        const statement = await cardsService.getCardStatement(
          userId, id, parseInt(month as string), parseInt(year as string)
        );
        if (!statement) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Card not found' } }) as any;
        }
        res.json({ data: statement });
      } catch (error) {
        next(error);
      }
    },
  };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import * as cardsService from './cards.service';

const defaultController = createCardsController(cardsService as ICardsService);

export const getAllCards = defaultController.getAllCards;
export const getCard = defaultController.getCard;
export const createCard = defaultController.createCard;
export const updateCard = defaultController.updateCard;
export const deleteCard = defaultController.deleteCard;
export const getCardStatement = defaultController.getCardStatement;
