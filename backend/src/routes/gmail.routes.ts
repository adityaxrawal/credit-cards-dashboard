import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as gmailController from '../controllers/gmail.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/status', gmailController.getStatus);
router.post('/connect', gmailController.connect);
router.post('/disconnect', gmailController.disconnect);
router.post('/scan-historical', gmailController.triggerHistoricalScan);
router.get('/scan-historical/:jobId', gmailController.getHistoricalScanStatus);
router.get('/last-sync', gmailController.getLastSync);
router.get('/jobs/latest', gmailController.getLatestJob);
router.get('/jobs/:jobId', gmailController.getHistoricalScanStatus);
router.post('/manual-map', gmailController.manualMap);
router.get('/stats', gmailController.getStats);
router.get('/reports/terminator', gmailController.getTerminatorReport);

export default router;
