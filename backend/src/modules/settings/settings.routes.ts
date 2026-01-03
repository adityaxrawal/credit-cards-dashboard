
import { Router } from 'express';
import { SettingsController } from './settings.controller';
import { PdfPasswordController } from './PdfPasswordController';
import { authenticate } from '@shared/middleware/auth.middleware';

const router = Router();

// Apply auth middleware to all settings routes
router.use(authenticate);

// General settings
router.get('/', SettingsController.getSettings);
router.patch('/', SettingsController.updateSettings);
router.post('/reset', SettingsController.resetSettings);

// PDF Password management
router.get('/pdf-passwords', PdfPasswordController.listPasswords);
router.post('/pdf-passwords', PdfPasswordController.addPassword);
router.delete('/pdf-passwords/:id', PdfPasswordController.deletePassword);
router.patch('/pdf-passwords/:id', PdfPasswordController.updatePassword);

export default router;

