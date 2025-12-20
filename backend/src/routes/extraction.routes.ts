import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as extractionController from '../controllers/extraction.controller';

const router = Router();

router.use(authenticate); // Require auth for all

router.post('/process-csv', extractionController.processCsv);

export default router;
