import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getSettings);
router.patch('/', updateSettings);

export default router;
