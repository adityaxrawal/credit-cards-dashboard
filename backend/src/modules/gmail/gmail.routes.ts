import { Router } from 'express';
import { authenticate, requireGmailConnection } from '@shared/middleware/auth.middleware';
import { expensiveLimiter } from '@shared/middleware/rateLimit.middleware';
import * as gmailController from './gmail.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/status', gmailController.getStatus);
router.post('/connect', gmailController.connect);
router.post('/disconnect', gmailController.disconnect);

// Routes requiring Gmail connection
router.post('/scan-historical', requireGmailConnection, expensiveLimiter, gmailController.triggerHistoricalScan);
router.get('/scan-historical/:jobId', requireGmailConnection, gmailController.getHistoricalScanStatus);
router.get('/last-sync', requireGmailConnection, gmailController.getLastSync);
router.get('/jobs/latest', requireGmailConnection, gmailController.getLatestJob);
router.get('/jobs/:jobId', requireGmailConnection, gmailController.getHistoricalScanStatus);
router.post('/manual-map', requireGmailConnection, expensiveLimiter, gmailController.manualMap);
router.get('/stats', requireGmailConnection, gmailController.getStats);
router.get('/logs', requireGmailConnection, gmailController.getIngestionLogs);
router.get('/reports/terminator', requireGmailConnection, gmailController.getTerminatorReport);

export default router;
