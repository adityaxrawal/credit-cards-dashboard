import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
import { AccountsService } from '../services/accounts/accounts.service';

const accountsService = new AccountsService();

/**
 * Get all accounts for user
 */
export async function getAllAccounts(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { type, status } = req.query;
        const accounts = await accountsService.getAll(userId, {
            type: type as string,
            status: status as string,
        });
        res.json({ data: accounts });
    } catch (error) {
        next(error);
    }
}

/**
 * Get account by ID
 */
export async function getAccountById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const account = await accountsService.getById(userId, id);
        if (!account) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Account not found' } });
        }
        res.json({ data: account });
    } catch (error) {
        next(error);
    }
}

/**
 * Create new account
 */
export async function createAccount(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const account = await accountsService.create(userId, req.body);
        res.status(201).json({ data: account });
    } catch (error) {
        next(error);
    }
}

/**
 * Update account
 */
export async function updateAccount(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const account = await accountsService.update(userId, id, req.body);
        if (!account) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Account not found' } });
        }
        res.json({ data: account });
    } catch (error) {
        next(error);
    }
}

/**
 * Delete (soft delete) account
 */
export async function deleteAccount(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        await accountsService.delete(userId, id);
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        next(error);
    }
}

/**
 * Update account balance manually
 */
export async function updateBalance(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { balance, notes } = req.body;
        const result = await accountsService.updateBalance(userId, id, balance, notes);
        res.json({ data: result });
    } catch (error) {
        next(error);
    }
}

/**
 * Get balance history for an account
 */
export async function getBalanceHistory(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { startDate, endDate } = req.query;
        const history = await accountsService.getBalanceHistory(userId, id, {
            startDate: startDate as string,
            endDate: endDate as string,
        });
        res.json({ data: history });
    } catch (error) {
        next(error);
    }
}

/**
 * Mark account as reconciled
 */
export async function reconcileAccount(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { date, notes } = req.body;
        const result = await accountsService.reconcile(userId, id, date, notes);
        res.json({ data: result });
    } catch (error) {
        next(error);
    }
}

/**
 * Get accounts summary (totals by type)
 */
export async function getAccountsSummary(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const summary = await accountsService.getSummary(userId);
        res.json({ data: summary });
    } catch (error) {
        next(error);
    }
}

/**
 * Freeze/unfreeze account
 */
export async function toggleAccountFreeze(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { freeze } = req.body;
        const result = await accountsService.toggleFreeze(userId, id, freeze);
        res.json({ data: result, message: freeze ? 'Account frozen' : 'Account unfrozen' });
    } catch (error) {
        next(error);
    }
}
