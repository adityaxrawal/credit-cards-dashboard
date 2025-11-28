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

export default router;
