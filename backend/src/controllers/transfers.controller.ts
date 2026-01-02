import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';

export interface ITransferService {
    createTransfer(userId: string, data: any): Promise<any>;
    findPotentialTransfers(userId: string): Promise<any>;
    linkAsTransfer(userId: string, debitId: string, creditId: string): Promise<any>;
    getTransferHistory(userId: string, limit: number): Promise<any>;
}

export interface ITransfersController {
    createTransfer(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    findPotentialTransfers(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    linkTransfer(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getTransferHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

export function createTransfersController(service: ITransferService): ITransfersController {
    return {
        async createTransfer(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { fromAccountId, toAccountId, amount, date, description, notes } = req.body;

                if (!fromAccountId || !toAccountId || !amount) {
                    res.status(400).json({
                        error: { code: 'VALIDATION_ERROR', message: 'fromAccountId, toAccountId, and amount are required' }
                    });
                    return;
                }

                if (fromAccountId === toAccountId) {
                    res.status(400).json({
                        error: { code: 'VALIDATION_ERROR', message: 'Cannot transfer to the same account' }
                    });
                    return;
                }

                const result = await service.createTransfer(userId, {
                    fromAccountId,
                    toAccountId,
                    amount,
                    date,
                    description,
                    notes,
                });

                res.status(201).json({ data: result });
            } catch (error) {
                next(error);
            }
        },

        async findPotentialTransfers(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const matches = await service.findPotentialTransfers(userId);
                res.json({ data: matches });
            } catch (error) {
                next(error);
            }
        },

        async linkTransfer(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { debitTransactionId, creditTransactionId } = req.body;

                if (!debitTransactionId || !creditTransactionId) {
                    res.status(400).json({
                        error: { code: 'VALIDATION_ERROR', message: 'debitTransactionId and creditTransactionId are required' }
                    });
                    return;
                }

                const result = await service.linkAsTransfer(userId, debitTransactionId, creditTransactionId);
                res.json({ data: result, message: 'Transactions linked as transfer' });
            } catch (error) {
                next(error);
            }
        },

        async getTransferHistory(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const limit = parseInt(req.query.limit as string) || 50;
                const transfers = await service.getTransferHistory(userId, limit);
                res.json({ data: transfers });
            } catch (error) {
                next(error);
            }
        }
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { TransferService } from '../services/transfers/transfer.service';
const defaultController = createTransfersController(new TransferService());

export const createTransfer = defaultController.createTransfer;
export const findPotentialTransfers = defaultController.findPotentialTransfers;
export const linkTransfer = defaultController.linkTransfer;
export const getTransferHistory = defaultController.getTransferHistory;
