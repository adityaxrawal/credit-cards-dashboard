
import { Router } from 'express';
import { authenticate } from '@shared/middleware/auth.middleware';
import * as rulesController from './rules.controller';

const router = Router();

router.use(authenticate);

router.get('/', rulesController.getRules);
router.post('/', rulesController.createRule);
router.put('/:id', rulesController.updateRule);
router.delete('/:id', rulesController.deleteRule);

export default router;
