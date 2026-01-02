import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';

export interface IStatementsService {
    getAllStatements(userId: string): Promise<any[]>;
    getStatementDetails(userId: string, cardId: string, month: number, year: number): Promise<any>;
    getCardStatements(userId: string, cardId: string): Promise<any[]>;
    processStatement(userId: string, buffer: Buffer, filename: string, bankName: string, password?: string): Promise<any>;
}

export interface IStatementsController {
    getAllStatements(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getStatementDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getCardStatements(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    uploadStatement(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

export function createStatementsController(service: IStatementsService): IStatementsController {
    return {
        async getAllStatements(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const statements = await service.getAllStatements(userId);

                res.json({
                    success: true,
                    data: statements
                });
            } catch (error) {
                next(error);
            }
        },

        async getStatementDetails(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { cardId, month, year } = req.params;

                const monthNum = parseInt(month);
                const yearNum = parseInt(year);

                if (isNaN(monthNum) || isNaN(yearNum) || monthNum < 1 || monthNum > 12) {
                    res.status(400).json({
                        success: false,
                        error: 'Invalid month or year parameters'
                    });
                    return;
                }

                const statement = await service.getStatementDetails(userId, cardId, monthNum, yearNum);

                if (!statement) {
                    res.status(404).json({
                        success: false,
                        error: 'Statement not found'
                    });
                    return;
                }

                res.json({
                    success: true,
                    data: statement
                });
            } catch (error) {
                next(error);
            }
        },

        async getCardStatements(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { cardId } = req.params;

                const statements = await service.getCardStatements(userId, cardId);

                res.json({
                    success: true,
                    data: statements
                });
            } catch (error) {
                next(error);
            }
        },

        async uploadStatement(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                if (!req.file) {
                    res.status(400).json({
                        success: false,
                        error: 'No file uploaded'
                    });
                    return;
                }

                const userId = req.user.id;
                const { bankName, password } = req.body;

                if (!bankName) {
                    res.status(400).json({
                        success: false,
                        error: 'Bank name is required'
                    });
                    return;
                }

                const result = await service.processStatement(
                    userId,
                    req.file.buffer,
                    req.file.originalname,
                    bankName,
                    password
                );

                res.json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import * as statementsQueries from '../db/queries/statements.queries';
import { StatementService } from '../services/statements/StatementService';

// Adapter for queries and static service
const statementsServiceAdapter: IStatementsService = {
    getAllStatements: (userId) => statementsQueries.getAllStatements(userId),
    getStatementDetails: (userId, cardId, month, year) => statementsQueries.getStatementDetails(userId, cardId, month, year),
    getCardStatements: (userId, cardId) => statementsQueries.getCardStatements(userId, cardId),
    processStatement: (userId, buffer, filename, bankName, password) => StatementService.processStatement(userId, buffer, filename, bankName, password)
};

const defaultController = createStatementsController(statementsServiceAdapter);

export const getAllStatements = defaultController.getAllStatements;
export const getStatementDetails = defaultController.getStatementDetails;
export const getCardStatements = defaultController.getCardStatements;
export const uploadStatement = defaultController.uploadStatement;
