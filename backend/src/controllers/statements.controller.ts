import { Request, Response, NextFunction } from 'express';
import * as statementsService from '../services/statements.service';

/**
 * Get all statements for the authenticated user
 */
export async function getAllStatements(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const statements = await statementsService.getAllStatements(userId);
    
    res.json({ data: statements });
  } catch (error) {
    next(error);
  }
}

/**
 * Get statement details for a specific card and billing period
 */
export async function getStatementDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { cardId, month, year } = req.params;
    
    if (!month || !year) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Month and year are required',
        },
      });
    }
    
    const statement = await statementsService.getStatementDetails(
      userId,
      cardId,
      parseInt(month),
      parseInt(year)
    );
    
    if (!statement) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Statement not found' } });
    }
    
    res.json({ data: statement });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all statements for a specific card
 */
export async function getCardStatements(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { cardId } = req.params;
    
    const statements = await statementsService.getCardStatements(userId, cardId);
    
    res.json({ data: statements });
  } catch (error) {
    next(error);
  }
}
