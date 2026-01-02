import { Router } from 'express';
import { googleLogin, getMe, refresh, logout } from './auth.controller';
import { authenticate } from '@shared/middleware/auth.middleware';
import { authLimiter } from '@shared/middleware/rateLimit.middleware';

const router = Router();

router.post('/google', authLimiter, googleLogin);
router.get('/me', authenticate, getMe);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', authenticate, logout);

export default router;
