import { Router } from 'express';
import * as syncController from '../controllers/sync.controller';

const router = Router();

/**
 * Sync Routes
 * 
 * POST /api/sync/historical - Trigger full historical scan
 * POST /api/sync/incremental - Trigger incremental sync
 * GET /api/sync/status/:jobId - Get job status
 * GET /api/sync/latest - Get latest job
 * GET /api/sync/debug/reconcile - Run reconciliation check
 * GET /api/sync/stats - Get ML statistics
 */

// Historical sync
router.post('/historical', syncController.triggerHistoricalSync);

// Incremental sync
router.post('/incremental', syncController.triggerIncrementalSync);

// Job status
router.get('/status/:jobId', syncController.getSyncStatus);

// Latest job
router.get('/latest', syncController.getLatestJob);

// Debug: Reconciliation
router.get('/debug/reconcile', syncController.runReconciliation);

// ML Statistics
router.get('/stats', syncController.getMLStats);

export default router;
