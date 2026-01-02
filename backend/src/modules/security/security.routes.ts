
import { Router } from 'express';
import { authenticate } from '@shared/middleware/auth.middleware';
import * as securityController from './security.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/sessions', securityController.getActiveSessions);
router.delete('/sessions/:sessionId', securityController.revokeSession);
router.delete('/sessions/others', securityController.revokeOtherSessions);

router.get('/export-data', securityController.exportUserData);
router.delete('/account', securityController.deleteAccount);

export default router;
