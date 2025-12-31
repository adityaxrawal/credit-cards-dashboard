import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    getLatestRates,
    convertCurrency,
    updateRate,
    getRateHistory,
    getUserCurrencies,
    updateUserCurrencies,
    getSupportedCurrencies,
} from '../controllers/currency.controller';

const router = Router();

// All currency routes require authentication
router.use(authenticate);

// Get supported currencies (no auth needed in practice, but keeping consistent)
router.get('/supported', getSupportedCurrencies);

// Exchange rates
router.get('/rates', getLatestRates);
router.get('/rates/history', getRateHistory);
router.post('/rates', updateRate);

// Conversion
router.get('/convert', convertCurrency);

// User preferences
router.get('/preferences', getUserCurrencies);
router.put('/preferences', updateUserCurrencies);

export default router;
