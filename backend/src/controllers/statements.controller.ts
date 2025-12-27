
import { Request, Response, NextFunction } from 'express';
import * as statementsQueries from '../db/queries/statements.queries';
import { AuthRequest } from '../types/auth.types';

/**
 * Get all statements
 */
export async function getAllStatements(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const userId = req.user.id;
        const statements = await statementsQueries.getAllStatements(userId);

        res.json({
            success: true,
            data: statements
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get statement details for a specific card and billing period
 */
export async function getStatementDetails(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const userId = req.user.id;
        const { cardId, month, year } = req.params;

        const monthNum = parseInt(month);
        const yearNum = parseInt(year);

        if (isNaN(monthNum) || isNaN(yearNum) || monthNum < 1 || monthNum > 12) {
            return res.status(400).json({
                success: false,
                error: 'Invalid month or year parameters'
            });
        }

        const statement = await statementsQueries.getStatementDetails(userId, cardId, monthNum, yearNum);

        if (!statement) {
            return res.status(404).json({
                success: false,
                error: 'Statement not found'
            });
        }

        res.json({
            success: true,
            data: statement
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get card statements
 */
export async function getCardStatements(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const userId = req.user.id;
        const { cardId } = req.params;

        const statements = await statementsQueries.getCardStatements(userId, cardId);

        res.json({
            success: true,
            data: statements
        });
    } catch (error) {
        next(error);
    }
}
