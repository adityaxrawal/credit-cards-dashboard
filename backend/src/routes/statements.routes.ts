import { Router } from 'express';
import * as statementsController from '../controllers/statements.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/statements - Get all statements
router.get('/', statementsController.getAllStatements);

// GET /api/statements/card/:cardId - Get statements for a specific card
router.get('/card/:cardId', statementsController.getCardStatements);

// GET /api/statements/:cardId/:month/:year - Get statement details
router.get('/:cardId/:month/:year', statementsController.getStatementDetails);

export default router;
