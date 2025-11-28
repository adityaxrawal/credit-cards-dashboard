import { Router } from 'express';
import { googleLogin, getMe, refresh, logout } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/google', googleLogin);
router.get('/me', authenticate, getMe);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);

export default router;
