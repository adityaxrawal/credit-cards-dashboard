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
import categoriesRoutes from './categories.routes';
import reportsRoutes from './reports.routes';
import manualReviewRoutes from './manual-review.routes';
import recurringRoutes from './recurring.routes';
import dashboardRoutes from './dashboard.routes';
import accountsRoutes from './accounts.routes';
import loansRoutes from './loans.routes';
import goalsRoutes from './goals.routes';
import transfersRoutes from './transfers.routes';
import importRoutes from './import.routes';
import sharedExpenseRoutes from './shared-expense.routes';
import currencyRoutes from './currency.routes';
import securityRoutes from './security.routes';


const router = Router();

// Auth routes (no /api prefix needed, it's added in app.ts)
router.use('/auth', authRoutes);

// Monitoring routes
router.use('/monitoring', monitoringRoutes);

// Dashboard routes
router.use('/dashboard', dashboardRoutes);

// Domain routes
router.use('/cards', cardsRoutes);
router.use('/accounts', accountsRoutes);
router.use('/transactions', transactionsRoutes);
router.use('/budget', budgetRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/alerts', alertsRoutes);
router.use('/gmail', gmailRoutes);

router.use('/rewards', rewardsRoutes);
router.use('/extraction', extractionRoutes);
router.use('/bills', billsRoutes);
router.use('/statements', statementsRoutes);
router.use('/categories', categoriesRoutes);
router.use('/reports', reportsRoutes);
router.use('/manual-review', manualReviewRoutes);
router.use('/recurring', recurringRoutes);
router.use('/loans', loansRoutes);
router.use('/goals', goalsRoutes);

// Phase 2 new routes
router.use('/transfers', transfersRoutes);
router.use('/import', importRoutes);
router.use('/shared-expenses', sharedExpenseRoutes);
router.use('/currency', currencyRoutes);

// Phase 5 security routes
router.use('/security', securityRoutes);

// Rules Engine
import rulesRoutes from './rules.routes';
router.use('/rules', rulesRoutes);



export default router;
