import express from 'express';
import { InstrumentsController } from '../controllers/instruments.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();
const controller = new InstrumentsController();

// Use authentication for all instrument routes
router.use(authenticate);

// Hierarchy & Discovery
router.get('/instruments', (req, res) => controller.getInstruments(req, res));
router.get('/instruments/hierarchy', (req, res) => controller.getHierarchy(req, res));
router.get('/instruments/search', (req, res) => controller.searchInstrument(req, res));
router.get('/instruments/:id', (req, res) => controller.getInstrument(req, res));

// Banks
router.get('/banks', (req, res) => controller.getBanks(req, res));

// Accounts
router.get('/accounts', (req, res) => controller.getAccounts(req, res));
router.post('/accounts', (req, res) => controller.createAccount(req, res));
router.get('/accounts/:accountId/instruments', (req, res) => controller.getAccountInstruments(req, res));

// Credit Cards
router.post('/credit-cards', (req, res) => controller.registerCreditCard(req, res));

// Debit Cards
router.post('/debit-cards', (req, res) => controller.registerDebitCard(req, res));

// UPI Handles
router.post('/upi-handles', (req, res) => controller.registerUPIHandle(req, res));

// Update & Delete
router.put('/instruments/:id', (req, res) => controller.updateInstrument(req, res));
router.delete('/instruments/:id', (req, res) => controller.deleteInstrument(req, res));

export default router;
