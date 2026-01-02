import { Router } from 'express';
import { authenticate } from '@shared/middleware/auth.middleware';
import * as billsController from './bills.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Bills CRUD operations
router.get('/', billsController.getAllBills);
router.get('/upcoming', billsController.getUpcomingBills);
router.get('/:billId', billsController.getBillById);
router.get('/card/:cardId', billsController.getCardBills);
router.post('/', billsController.createBill);
router.put('/:billId', billsController.updateBill);
router.delete('/:billId', billsController.deleteBill);

export default router;
