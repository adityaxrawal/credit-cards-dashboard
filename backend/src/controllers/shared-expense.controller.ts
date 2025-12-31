import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
import { SharedExpenseService } from '../services/shared/shared-expense.service';

const sharedExpenseService = new SharedExpenseService();

/**
 * Create shared expense
 */
export async function createSharedExpense(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const expense = await sharedExpenseService.create(userId, req.body);
        res.status(201).json({ data: expense });
    } catch (error) {
        next(error);
    }
}

/**
 * Get all shared expenses
 */
export async function getSharedExpenses(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { status } = req.query;
        const expenses = await sharedExpenseService.getAll(userId, { status: status as string });
        res.json({ data: expenses });
    } catch (error) {
        next(error);
    }
}

/**
 * Get shared expense by ID
 */
export async function getSharedExpenseById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const expense = await sharedExpenseService.getById(userId, id);

        if (!expense) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shared expense not found' } });
        }

        res.json({ data: expense });
    } catch (error) {
        next(error);
    }
}

/**
 * Mark split as paid
 */
export async function markSplitPaid(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { splitId } = req.params;
        const split = await sharedExpenseService.markSplitPaid(userId, splitId);
        res.json({ data: split, message: 'Split marked as paid' });
    } catch (error) {
        next(error);
    }
}

/**
 * Get settlement summary
 */
export async function getSettlementSummary(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const summary = await sharedExpenseService.getSettlementSummary(userId);
        res.json({ data: summary });
    } catch (error) {
        next(error);
    }
}

/**
 * Delete shared expense
 */
export async function deleteSharedExpense(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        await sharedExpenseService.delete(userId, id);
        res.json({ message: 'Shared expense deleted' });
    } catch (error) {
        next(error);
    }
}
