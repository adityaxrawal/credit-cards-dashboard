import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import * as cardsController from '../controllers/cards.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', cardsController.getAllCards);
router.post('/', cardsController.createCard);
router.get('/:id', cardsController.getCard);
router.put('/:id', cardsController.updateCard);
router.delete('/:id', cardsController.deleteCard);
router.get('/:id/statements', cardsController.getCardStatement);

export default router;
