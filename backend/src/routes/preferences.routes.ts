/**
 * Preferences Routes
 * API routes for notification preferences
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as preferencesController from '../controllers/preferences.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/preferences - Get user preferences
router.get('/', preferencesController.getPreferences);

// PUT /api/preferences - Update preferences
router.put('/', preferencesController.updatePreferences);

// POST /api/preferences/reset - Reset to defaults
router.post('/reset', preferencesController.resetPreferences);

// GET /api/preferences/quiet-hours/check - Check if quiet hours active
router.get('/quiet-hours/check', preferencesController.checkQuietHours);

export default router;
