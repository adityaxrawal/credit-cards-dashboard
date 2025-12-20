import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as monitoringController from '../controllers/monitoring.controller';

const router = Router();

// All monitoring routes require authentication
router.use(authenticate);

router.get('/stats', monitoringController.getStats);
router.get('/accuracy', monitoringController.getAccuracy);
router.get('/terminations', monitoringController.getTerminations);

export default router;
