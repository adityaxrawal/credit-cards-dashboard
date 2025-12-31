import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as budgetController from '../controllers/budget.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/current', budgetController.getCurrentBudget);
router.put('/', budgetController.updateBudget);
router.get('/history', budgetController.getBudgetHistory);

// Advanced Budgeting
router.get('/envelopes', budgetController.getCategoryBudgets);
router.post('/envelopes', budgetController.setCategoryBudget);
router.get('/rules/rollover', budgetController.getRolloverRule);
router.post('/rules/rollover', budgetController.setRolloverRule);

router.post('/savings/link', budgetController.linkSavings);
router.get('/alerts', budgetController.getAlerts);



export default router;
