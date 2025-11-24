import { Router } from 'express';
import { getTransactions, createTransaction, bulkImportTransactions } from '../controllers/transactionController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getTransactions);
router.post('/', createTransaction);
router.post('/bulk-import', bulkImportTransactions);

export default router;
