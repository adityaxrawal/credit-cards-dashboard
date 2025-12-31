
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as statementsController from '../controllers/statements.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Multer setup
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

// Statements Routes
router.get('/', statementsController.getAllStatements);
router.post('/upload', upload.single('file'), statementsController.uploadStatement);
router.get('/:cardId/:month/:year', statementsController.getStatementDetails);
router.get('/card/:cardId', statementsController.getCardStatements);

export default router;
