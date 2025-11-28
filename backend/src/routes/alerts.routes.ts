import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as alertsController from '../controllers/alerts.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', alertsController.getAlerts);
router.put('/:id/read', alertsController.markAsRead);
router.delete('/:id', alertsController.deleteAlert);

export default router;
