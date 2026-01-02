/**
 * Recurring Transactions Routes
 */

import { Router } from 'express';
import { authenticate } from '@shared/middleware/auth.middleware';
import * as recurringController from './recurring.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/recurring
 * @desc    Get all recurring patterns
 * @access  Private
 */
router.get('/', recurringController.getPatterns);

/**
 * @route   POST /api/recurring/detect
 * @desc    Detect recurring patterns from transaction history
 * @access  Private
 */
router.post('/detect', recurringController.detectPatterns);

/**
 * @route   POST /api/recurring/save
 * @desc    Save detected patterns
 * @access  Private
 */
router.post('/save', recurringController.savePatterns);

/**
 * @route   PUT /api/recurring/:id/pause
 * @desc    Pause a recurring pattern
 * @access  Private
 */
router.put('/:id/pause', recurringController.pausePattern);

/**
 * @route   PUT /api/recurring/:id/resume
 * @desc    Resume a paused pattern
 * @access  Private
 */
router.put('/:id/resume', recurringController.resumePattern);

/**
 * @route   PUT /api/recurring/:id/confirm
 * @desc    Confirm a pattern (user verification)
 * @access  Private
 */
router.put('/:id/confirm', recurringController.confirmPattern);

/**
 * @route   DELETE /api/recurring/:id
 * @desc    Delete a recurring pattern
 * @access  Private
 */
router.delete('/:id', recurringController.deletePattern);

export default router;
