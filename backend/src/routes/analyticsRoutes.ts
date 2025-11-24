import { Router } from 'express';
import { getOverview, getSpendingTrends, getCategoryBreakdown } from '../controllers/analyticsController';
import { authenticate } from '../middleware/authMiddleware';
import { cache } from '../middleware/cacheMiddleware';

const router = Router();

router.use(authenticate);

// Cache overview for 5 minutes
router.get('/overview', cache(300), getOverview);
// Cache trends for 1 hour
router.get('/spending-trends', cache(3600), getSpendingTrends);
// Cache category breakdown for 1 hour
router.get('/category-breakdown', cache(3600), getCategoryBreakdown);

export default router;
