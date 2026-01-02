import { Router } from 'express';
import { authenticate } from '@shared/middleware/auth.middleware';
import * as analyticsController from './analytics.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/overview', analyticsController.getOverview);
router.get('/categories', analyticsController.getCategoryBreakdown);
router.get('/trends', analyticsController.getTrends);
router.get('/merchants', analyticsController.getTopMerchants);

export default router;
