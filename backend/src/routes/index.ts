import { Router } from 'express';
import authRoutes from './auth.routes';
import cardsRoutes from './cards.routes';
import transactionsRoutes from './transactions.routes';
import budgetRoutes from './budget.routes';
import analyticsRoutes from './analytics.routes';
import alertsRoutes from './alerts.routes';
import gmailRoutes from './gmail.routes';

import rewardsRoutes from './rewards.routes';
import extractionRoutes from './extraction.routes';
import billsRoutes from './bills.routes';
import monitoringRoutes from './monitoring.routes';
import statementsRoutes from './statements.routes';


const router = Router();

// Auth routes (no /api prefix needed, it's added in app.ts)
router.use('/auth', authRoutes);

// Monitoring routes
router.use('/monitoring', monitoringRoutes);

// Domain routes
router.use('/cards', cardsRoutes);
router.use('/transactions', transactionsRoutes);
router.use('/budget', budgetRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/alerts', alertsRoutes);
router.use('/gmail', gmailRoutes);

router.use('/rewards', rewardsRoutes);
router.use('/extraction', extractionRoutes);
router.use('/bills', billsRoutes);
router.use('/statements', statementsRoutes);


export default router;

