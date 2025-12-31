import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    createTransfer,
    findPotentialTransfers,
    linkTransfer,
    getTransferHistory,
} from '../controllers/transfers.controller';

const router = Router();

// All transfer routes require authentication
router.use(authenticate);

// Create internal transfer
router.post('/', createTransfer);

// Find potential transfer matches
router.get('/potential-matches', findPotentialTransfers);

// Link two transactions as transfer
router.post('/link', linkTransfer);

// Get transfer history
router.get('/history', getTransferHistory);

export default router;
