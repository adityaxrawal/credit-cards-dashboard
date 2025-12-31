import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    getAllGoals,
    getGoalById,
    createGoal,
    updateGoal,
    deleteGoal,
    addContribution,
    getContributions,
    getGoalProgress,
    getGoalsSummary,
} from '../controllers/goals.controller';

const router = Router();

// All goals routes require authentication
router.use(authenticate);

// Summary
router.get('/summary', getGoalsSummary);

// CRUD operations
router.get('/', getAllGoals);
router.get('/:id', getGoalById);
router.post('/', createGoal);
router.put('/:id', updateGoal);
router.delete('/:id', deleteGoal);

// Contributions
router.get('/:id/contributions', getContributions);
router.post('/:id/contribute', addContribution);

// Progress
router.get('/:id/progress', getGoalProgress);

export default router;
