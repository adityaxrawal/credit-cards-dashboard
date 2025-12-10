import { Router } from 'express';
import * as AdminController from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware'; // Assuming this exists

const router = Router();

// Protect these routes
router.use(authenticate);

router.get('/review-queue', AdminController.getReviewQueue);
router.post('/review/:id', AdminController.reviewItem);

export default router;
