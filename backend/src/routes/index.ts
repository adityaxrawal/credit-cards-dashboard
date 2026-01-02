import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import cardsRoutes from '../modules/cards/cards.routes';
import transactionsRoutes from '@modules/transactions/transactions.routes';
import budgetRoutes from '../modules/budget/budget.routes';
import analyticsRoutes from '../modules/analytics/analytics.routes';
import alertsRoutes from '../modules/alerts/alerts.routes';
import gmailRoutes from '../modules/gmail/gmail.routes';

import rewardsRoutes from '../modules/rewards/rewards.routes';
import extractionRoutes from '../modules/extraction/extraction.routes';
import billsRoutes from '../modules/bills/bills.routes';
import monitoringRoutes from '../modules/monitoring/monitoring.routes';
// // import statementsRoutes from '../modules/statements/statements.routes';
import categoriesRoutes from '../modules/categories/categories.routes';
import reportsRoutes from '../modules/reports/reports.routes';
import manualReviewRoutes from '../modules/manual-review/manual-review.routes';
import recurringRoutes from '../modules/recurring/recurring.routes';
import dashboardRoutes from '../modules/dashboard/dashboard.routes';
import accountsRoutes from '../modules/accounts/accounts.routes';
import loansRoutes from '../modules/loans/loans.routes';
import goalsRoutes from '../modules/goals/goals.routes';
import transfersRoutes from '../modules/transfers/transfers.routes';
import importRoutes from '../modules/import/import.routes';
import sharedExpenseRoutes from '../modules/shared-expense/shared-expense.routes';
import currencyRoutes from '../modules/currency/currency.routes';
import securityRoutes from '../modules/security/security.routes';


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
// router.use('/statements', statementsRoutes);
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

import settingsRoutes from '../modules/settings/settings.routes';
router.use('/settings', settingsRoutes);

// Rules Engine
import rulesRoutes from '../modules/rules/rules.routes';
router.use('/rules', rulesRoutes);



export default router;
