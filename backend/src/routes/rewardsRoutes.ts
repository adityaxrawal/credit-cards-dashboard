import { Router } from 'express';
import { getRewardsSummary, getCardRewardsHistory, redeemPoints } from '../controllers/rewardsController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getRewardsSummary);
router.get('/:cardId', getCardRewardsHistory);
router.post('/redeem', redeemPoints);

export default router;
