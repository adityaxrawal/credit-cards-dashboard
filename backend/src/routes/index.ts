import { Router } from 'express';
import authRoutes from './authRoutes';
import cardRoutes from './cardRoutes';
import transactionRoutes from './transactionRoutes';
import billRoutes from './billRoutes';
import statementRoutes from './statementRoutes';
import rewardsRoutes from './rewardsRoutes';
import analyticsRoutes from './analyticsRoutes';
import gmailRoutes from './gmailRoutes';
import settingsRoutes from './settingsRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/cards', cardRoutes);
router.use('/transactions', transactionRoutes);
router.use('/bills', billRoutes);
router.use('/statements', statementRoutes);
router.use('/rewards', rewardsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/gmail', gmailRoutes);
router.use('/settings', settingsRoutes);

router.get('/', (req, res) => {
  res.json({ message: 'Welcome to Credit Card Dashboard API' });
});

export default router;
