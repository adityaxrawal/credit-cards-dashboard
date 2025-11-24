import { Router } from 'express';
import { googleLogin, getMe, refresh, logout } from '../controllers/authController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.post('/google', googleLogin);
router.get('/me', authenticate, getMe);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);

export default router;
