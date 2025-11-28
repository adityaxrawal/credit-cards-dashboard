import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import * as budgetController from '../controllers/budget.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/current', budgetController.getCurrentBudget);
router.put('/', budgetController.updateBudget);
router.get('/history', budgetController.getBudgetHistory);

export default router;
