import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as extractionController from '../controllers/extraction.controller';
import { expensiveLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.use(authenticate); // Require auth for all

router.post('/process-csv', expensiveLimiter, extractionController.processCsv);

export default router;
