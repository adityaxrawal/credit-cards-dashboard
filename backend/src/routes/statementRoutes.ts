import { Router } from 'express';
import { uploadStatement, getStatements, getStatement } from '../controllers/statementController';
import { authenticate } from '../middleware/authMiddleware';
import { upload } from '../lib/storage';

const router = Router();

router.use(authenticate);

router.post('/upload', upload.single('file'), uploadStatement);
router.get('/', getStatements);
router.get('/:id', getStatement);

export default router;
