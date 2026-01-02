import { Router } from 'express';
import { authenticate } from '@shared/middleware/auth.middleware';
import {
    getAllLoans,
    getLoanById,
    createLoan,
    updateLoan,
    deleteLoan,
    getAmortization,
    recordPayment,
    getPaymentHistory,
    calculatePrepayment,
    getLoansSummary,
} from './loans.controller';

const router = Router();

// All loans routes require authentication
router.use(authenticate);

// Summary
router.get('/summary', getLoansSummary);

// CRUD operations
router.get('/', getAllLoans);
router.get('/:id', getLoanById);
router.post('/', createLoan);
router.put('/:id', updateLoan);
router.delete('/:id', deleteLoan);

// Amortization and payments
router.get('/:id/amortization', getAmortization);
router.get('/:id/payments', getPaymentHistory);
router.post('/:id/payment', recordPayment);

// Prepayment calculator
router.post('/:id/prepay', calculatePrepayment);

export default router;
