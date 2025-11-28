import { Router } from 'express';
import * as billsController from '../controllers/bills.controller';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/bills - Get all bills
router.get('/', billsController.getAllBills);

// GET /api/bills/upcoming - Get upcoming bills
router.get('/upcoming', billsController.getUpcomingBills);

// GET /api/bills/:id - Get a specific bill
router.get('/:id', billsController.getBill);

// GET /api/bills/card/:cardId - Get bills for a specific card
router.get('/card/:cardId', billsController.getCardBills);

// POST /api/bills - Create a new bill
router.post('/', billsController.createBill);

// PATCH /api/bills/:id - Update a bill
router.patch('/:id', billsController.updateBill);

// DELETE /api/bills/:id - Delete a bill
router.delete('/:id', billsController.deleteBill);

export default router;
