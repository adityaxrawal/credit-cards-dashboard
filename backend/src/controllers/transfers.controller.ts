import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
import { TransferService } from '../services/transfers/transfer.service';

const transferService = new TransferService();

/**
 * Create internal transfer between accounts
 */
export async function createTransfer(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { fromAccountId, toAccountId, amount, date, description, notes } = req.body;

        if (!fromAccountId || !toAccountId || !amount) {
            return res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: 'fromAccountId, toAccountId, and amount are required' }
            });
        }

        if (fromAccountId === toAccountId) {
            return res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: 'Cannot transfer to the same account' }
            });
        }

        const result = await transferService.createTransfer(userId, {
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
}

/**
 * Find potential transfer matches
 */
export async function findPotentialTransfers(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const matches = await transferService.findPotentialTransfers(userId);
        res.json({ data: matches });
    } catch (error) {
        next(error);
    }
}

/**
 * Link two transactions as a transfer
 */
export async function linkTransfer(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { debitTransactionId, creditTransactionId } = req.body;

        if (!debitTransactionId || !creditTransactionId) {
            return res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: 'debitTransactionId and creditTransactionId are required' }
            });
        }

        const result = await transferService.linkAsTransfer(userId, debitTransactionId, creditTransactionId);
        res.json({ data: result, message: 'Transactions linked as transfer' });
    } catch (error) {
        next(error);
    }
}

/**
 * Get transfer history
 */
export async function getTransferHistory(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit as string) || 50;
        const transfers = await transferService.getTransferHistory(userId, limit);
        res.json({ data: transfers });
    } catch (error) {
        next(error);
    }
}
