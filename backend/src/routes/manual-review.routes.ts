/**
 * Manual Review Routes
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as manualReviewController from '../controllers/manual-review.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/manual-review/queue
 * @desc    Get pending review items
 * @access  Private
 */
router.get('/queue', manualReviewController.getQueue);

/**
 * @route   GET /api/manual-review/stats
 * @desc    Get queue statistics
 * @access  Private
 */
router.get('/stats', manualReviewController.getQueueStats);

/**
 * @route   POST /api/manual-review/:id/approve
 * @desc    Approve a review item and create transaction
 * @access  Private
 */
router.post('/:id/approve', manualReviewController.approveItem);

/**
 * @route   POST /api/manual-review/:id/reject
 * @desc    Reject a review item
 * @access  Private
 */
router.post('/:id/reject', manualReviewController.rejectItem);

/**
 * @route   POST /api/manual-review/:id/skip
 * @desc    Skip a review item for later
 * @access  Private
 */
router.post('/:id/skip', manualReviewController.skipItem);

/**
 * @route   POST /api/manual-review/bulk-approve
 * @desc    Bulk approve multiple items
 * @access  Private
 */
router.post('/bulk-approve', manualReviewController.bulkApprove);

export default router;
