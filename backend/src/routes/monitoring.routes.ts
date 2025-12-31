import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as monitoringController from '../controllers/monitoring.controller';

const router = Router();

// Public health check endpoint (no auth required)
router.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime(),
    });
});

// All other monitoring routes require authentication
router.use(authenticate);

router.get('/stats', monitoringController.getStats);
router.get('/accuracy', monitoringController.getAccuracy);
router.get('/terminations', monitoringController.getTerminations);

export default router;
