import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
import { CurrencyService } from '../services/currency/currency.service';

const currencyService = new CurrencyService();

/**
 * Get latest exchange rates
 */
export async function getLatestRates(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const baseCurrency = (req.query.base as string) || 'INR';
        const rates = await currencyService.getLatestRates(baseCurrency);
        res.json({ data: rates });
    } catch (error) {
        next(error);
    }
}

/**
 * Convert amount between currencies
 */
export async function convertCurrency(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const { amount, from, to } = req.query;

        if (!amount || !from || !to) {
            return res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: 'amount, from, and to parameters are required' }
            });
        }

        const result = await currencyService.convert(
            parseFloat(amount as string),
            from as string,
            to as string
        );

        res.json({ data: result });
    } catch (error) {
        next(error);
    }
}

/**
 * Update exchange rate
 */
export async function updateRate(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const { baseCurrency, targetCurrency, rate, source } = req.body;

        if (!baseCurrency || !targetCurrency || !rate) {
            return res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: 'baseCurrency, targetCurrency, and rate are required' }
            });
        }

        const result = await currencyService.updateRate(baseCurrency, targetCurrency, rate, source);
        res.json({ data: result });
    } catch (error) {
        next(error);
    }
}

/**
 * Get rate history
 */
export async function getRateHistory(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const { base, target, days = '30' } = req.query;

        if (!base || !target) {
            return res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: 'base and target parameters are required' }
            });
        }

        const history = await currencyService.getRateHistory(
            base as string,
            target as string,
            parseInt(days as string)
        );

        res.json({ data: history });
    } catch (error) {
        next(error);
    }
}

/**
 * Get user's currency preferences
 */
export async function getUserCurrencies(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const preferences = await currencyService.getUserCurrencies(userId);
        res.json({ data: preferences });
    } catch (error) {
        next(error);
    }
}

/**
 * Update user's currency preferences
 */
export async function updateUserCurrencies(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { baseCurrency, secondaryCurrencies } = req.body;

        await currencyService.updateUserCurrencies(userId, baseCurrency, secondaryCurrencies);
        res.json({ message: 'Currency preferences updated' });
    } catch (error) {
        next(error);
    }
}

/**
 * Get supported currencies
 */
export async function getSupportedCurrencies(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const currencies = currencyService.getSupportedCurrencies();
        res.json({ data: currencies });
    } catch (error) {
        next(error);
    }
}
