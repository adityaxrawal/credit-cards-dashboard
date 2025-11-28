import { Router } from 'express';
import * as rewardsController from '../controllers/rewards.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/rewards - Get all rewards
router.get('/', rewardsController.getAllRewards);

// GET /api/rewards/summary - Get rewards summary
router.get('/summary', rewardsController.getRewardsSummary);

// GET /api/rewards/:cardId - Get rewards for a specific card
router.get('/:cardId', rewardsController.getCardRewards);

// GET /api/rewards/:cardId/transactions - Get reward transactions
router.get('/:cardId/transactions', rewardsController.getRewardTransactions);

// POST /api/rewards - Update reward points
router.post('/', rewardsController.upsertRewardPoints);

// POST /api/rewards/transactions - Create a reward transaction
router.post('/transactions', rewardsController.createRewardTransaction);

export default router;
