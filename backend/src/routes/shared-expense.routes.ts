import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    createSharedExpense,
    getSharedExpenses,
    getSharedExpenseById,
    markSplitPaid,
    getSettlementSummary,
    deleteSharedExpense,
} from '../controllers/shared-expense.controller';

const router = Router();

// All shared expense routes require authentication
router.use(authenticate);

// Settlement summary
router.get('/summary', getSettlementSummary);

// CRUD
router.get('/', getSharedExpenses);
router.get('/:id', getSharedExpenseById);
router.post('/', createSharedExpense);
router.delete('/:id', deleteSharedExpense);

// Mark split as paid
router.post('/splits/:splitId/pay', markSplitPaid);

export default router;
