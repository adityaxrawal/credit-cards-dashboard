import { Router } from 'express';
import { getCards, createCard, getCard, updateCard, deleteCard } from '../controllers/cardController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getCards);
router.post('/', createCard);
router.get('/:id', getCard);
router.put('/:id', updateCard);
router.delete('/:id', deleteCard);

export default router;
