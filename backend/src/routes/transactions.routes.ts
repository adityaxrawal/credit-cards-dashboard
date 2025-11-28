import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as transactionsController from '../controllers/transactions.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', transactionsController.getTransactions);
router.post('/', transactionsController.createTransaction);
router.get('/:id', transactionsController.getTransaction);
router.put('/:id', transactionsController.updateTransaction);
router.delete('/:id', transactionsController.deleteTransaction);

export default router;
