/**
 * Accounts Controller
 * 
 * Handles bank account management endpoints.
 * Uses factory pattern for dependency injection.
 * 
 * Part of Issue #12: Controller-Service Dependency Injection
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';

/**
 * Accounts Service Interface
 */
export interface IAccountsService {
    getAll(userId: string, filters: { type?: string; status?: string }): Promise<any[]>;
    getById(userId: string, id: string): Promise<any>;
    create(userId: string, data: any): Promise<any>;
    update(userId: string, id: string, data: any): Promise<any>;
    delete(userId: string, id: string): Promise<void>;
    updateBalance(userId: string, id: string, balance: number, notes?: string): Promise<any>;
    getBalanceHistory(userId: string, id: string, filters: { startDate?: string; endDate?: string }): Promise<any>;
    reconcile(userId: string, id: string, date: string, notes?: string): Promise<any>;
    getSummary(userId: string): Promise<any>;
    toggleFreeze(userId: string, id: string, freeze: boolean): Promise<any>;
}

/**
 * Controller Interface
 */
export interface IAccountsController {
    getAllAccounts(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getAccountById(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    createAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deleteAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getBalanceHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    reconcileAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getAccountsSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    toggleAccountFreeze(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

/**
 * Factory function to create Accounts controller with injected dependencies
 */
export function createAccountsController(accountsService: IAccountsService): IAccountsController {
    return {
        async getAllAccounts(req, res, next) {
            try {
                const userId = req.user.id;
                const { type, status } = req.query;
                const accounts = await accountsService.getAll(userId, { type: type as string, status: status as string });
                res.json({ success: true, data: accounts });
            } catch (error) { next(error); }
        },

        async getAccountById(req, res, next) {
            try {
                const account = await accountsService.getById(req.user.id, req.params.id);
                if (!account) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Account not found' } }) as any;
                res.json({ success: true, data: account });
            } catch (error) { next(error); }
        },

        async createAccount(req, res, next) {
            try {
                const account = await accountsService.create(req.user.id, req.body);
                res.status(201).json({ success: true, data: account });
            } catch (error) { next(error); }
        },

        async updateAccount(req, res, next) {
            try {
                const account = await accountsService.update(req.user.id, req.params.id, req.body);
                if (!account) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Account not found' } }) as any;
                res.json({ success: true, data: account });
            } catch (error) { next(error); }
        },

        async deleteAccount(req, res, next) {
            try {
                await accountsService.delete(req.user.id, req.params.id);
                res.json({ success: true, message: 'Account deleted successfully' });
            } catch (error) { next(error); }
        },

        async updateBalance(req, res, next) {
            try {
                const { balance, notes } = req.body;
                const result = await accountsService.updateBalance(req.user.id, req.params.id, balance, notes);
                res.json({ success: true, data: result });
            } catch (error) { next(error); }
        },

        async getBalanceHistory(req, res, next) {
            try {
                const { startDate, endDate } = req.query;
                const history = await accountsService.getBalanceHistory(req.user.id, req.params.id, { startDate: startDate as string, endDate: endDate as string });
                res.json({ success: true, data: history });
            } catch (error) { next(error); }
        },

        async reconcileAccount(req, res, next) {
            try {
                const { date, notes } = req.body;
                const result = await accountsService.reconcile(req.user.id, req.params.id, date, notes);
                res.json({ success: true, data: result });
            } catch (error) { next(error); }
        },

        async getAccountsSummary(req, res, next) {
            try {
                const summary = await accountsService.getSummary(req.user.id);
                res.json({ success: true, data: summary });
            } catch (error) { next(error); }
        },

        async toggleAccountFreeze(req, res, next) {
            try {
                const { freeze } = req.body;
                const result = await accountsService.toggleFreeze(req.user.id, req.params.id, freeze);
                res.json({ success: true, data: result, message: freeze ? 'Account frozen' : 'Account unfrozen' });
            } catch (error) { next(error); }
        },
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { AccountsService } from '../services/accounts/accounts.service';

const accountsService = new AccountsService();
const defaultController = createAccountsController(accountsService as IAccountsService);

export const getAllAccounts = defaultController.getAllAccounts;
export const getAccountById = defaultController.getAccountById;
export const createAccount = defaultController.createAccount;
export const updateAccount = defaultController.updateAccount;
export const deleteAccount = defaultController.deleteAccount;
export const updateBalance = defaultController.updateBalance;
export const getBalanceHistory = defaultController.getBalanceHistory;
export const reconcileAccount = defaultController.reconcileAccount;
export const getAccountsSummary = defaultController.getAccountsSummary;
export const toggleAccountFreeze = defaultController.toggleAccountFreeze;
