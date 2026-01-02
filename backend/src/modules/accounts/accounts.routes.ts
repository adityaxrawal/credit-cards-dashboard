import { Router } from 'express';
import { authenticate } from '@shared/middleware/auth.middleware';
import {
    getAllAccounts,
    getAccountById,
    createAccount,
    updateAccount,
    deleteAccount,
    updateBalance,
    getBalanceHistory,
    reconcileAccount,
    getAccountsSummary,
    toggleAccountFreeze,
} from './accounts.controller';

const router = Router();

// All accounts routes require authentication
router.use(authenticate);

// Summary - get totals by account type
router.get('/summary', getAccountsSummary);

// CRUD operations
router.get('/', getAllAccounts);
router.get('/:id', getAccountById);
router.post('/', createAccount);
router.put('/:id', updateAccount);
router.delete('/:id', deleteAccount);

// Balance operations
router.post('/:id/balance', updateBalance);
router.get('/:id/history', getBalanceHistory);

// Reconciliation
router.post('/:id/reconcile', reconcileAccount);

// Freeze/unfreeze
router.post('/:id/freeze', toggleAccountFreeze);

export default router;
