import { Router } from 'express';
import { authenticate } from '@shared/middleware/auth.middleware';
import {
    getTemplates,
    saveTemplate,
    parseCSV,
    previewImport,
    executeImport,
    getImportHistory,
} from './import.controller';

const router = Router();

// All import routes require authentication
router.use(authenticate);

// Templates
router.get('/templates', getTemplates);
router.post('/templates', saveTemplate);

// CSV Processing
router.post('/parse', parseCSV);
router.post('/preview', previewImport);
router.post('/execute', executeImport);

// History
router.get('/history', getImportHistory);

export default router;
