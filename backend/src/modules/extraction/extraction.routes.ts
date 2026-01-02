import { Router } from 'express';
import { authenticate } from '@shared/middleware/auth.middleware';
import * as extractionController from './extraction.controller';
import { expensiveLimiter } from '@shared/middleware/rateLimit.middleware';

const router = Router();

router.use(authenticate); // Require auth for all

router.post('/process-csv', expensiveLimiter, extractionController.processCsv);

export default router;
