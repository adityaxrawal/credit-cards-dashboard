import { Router } from 'express';
import { authenticate } from '@shared/middleware/auth.middleware';
import * as alertsController from './alerts.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', alertsController.getAlerts);
router.put('/:id/read', alertsController.markAsRead);
router.delete('/:id', alertsController.deleteAlert);

export default router;
