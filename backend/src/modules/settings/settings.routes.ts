
import { Router } from 'express';
import { SettingsController } from './settings.controller';
import { authenticate } from '@shared/middleware/auth.middleware';

const router = Router();

// Apply auth middleware to all settings routes
router.use(authenticate);

router.get('/', SettingsController.getSettings);
router.patch('/', SettingsController.updateSettings);
router.post('/reset', SettingsController.resetSettings);

export default router;
