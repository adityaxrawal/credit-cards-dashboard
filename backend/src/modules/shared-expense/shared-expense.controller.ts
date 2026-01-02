import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '@shared/types/auth.types';

export interface ISharedExpenseService {
    create(userId: string, data: any): Promise<any>;
    getAll(userId: string, filters: any): Promise<any>;
    getById(userId: string, id: string): Promise<any>;
    markSplitPaid(userId: string, splitId: string): Promise<any>;
    getSettlementSummary(userId: string): Promise<any>;
    delete(userId: string, id: string): Promise<void>;
}

export interface ISharedExpenseController {
    createSharedExpense(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getSharedExpenses(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getSharedExpenseById(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    markSplitPaid(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getSettlementSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deleteSharedExpense(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

export function createSharedExpenseController(service: ISharedExpenseService): ISharedExpenseController {
    return {
        async createSharedExpense(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const expense = await service.create(userId, req.body);
                res.status(201).json({ data: expense });
            } catch (error) {
                next(error);
            }
        },

        async getSharedExpenses(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { status } = req.query;
                const expenses = await service.getAll(userId, { status: status as string });
                res.json({ data: expenses });
            } catch (error) {
                next(error);
            }
        },

        async getSharedExpenseById(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { id } = req.params;
                const expense = await service.getById(userId, id);

                if (!expense) {
                    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shared expense not found' } });
                    return;
                }

                res.json({ data: expense });
            } catch (error) {
                next(error);
            }
        },

        async markSplitPaid(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { splitId } = req.params;
                const split = await service.markSplitPaid(userId, splitId);
                res.json({ data: split, message: 'Split marked as paid' });
            } catch (error) {
                next(error);
            }
        },

        async getSettlementSummary(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const summary = await service.getSettlementSummary(userId);
                res.json({ data: summary });
            } catch (error) {
                next(error);
            }
        },

        async deleteSharedExpense(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { id } = req.params;
                await service.delete(userId, id);
                res.json({ message: 'Shared expense deleted' });
            } catch (error) {
                next(error);
            }
        }
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { SharedExpenseService } from './shared-expense.service';
const defaultController = createSharedExpenseController(new SharedExpenseService());

export const createSharedExpense = defaultController.createSharedExpense;
export const getSharedExpenses = defaultController.getSharedExpenses;
export const getSharedExpenseById = defaultController.getSharedExpenseById;
export const markSplitPaid = defaultController.markSplitPaid;
export const getSettlementSummary = defaultController.getSettlementSummary;
export const deleteSharedExpense = defaultController.deleteSharedExpense;
