import { Router } from 'express';
import { connectGmail, syncGmail, getAuthUrl, handleWebhook } from '../controllers/gmailController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.post('/auth', getAuthUrl);
router.post('/connect', connectGmail);
router.post('/sync', syncGmail);
router.post('/webhook', handleWebhook);

export default router;
