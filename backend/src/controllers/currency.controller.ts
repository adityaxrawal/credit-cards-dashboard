import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';

export interface ICurrencyService {
    getLatestRates(baseCurrency: string): Promise<any>;
    convert(amount: number, from: string, to: string): Promise<any>;
    updateRate(base: string, target: string, rate: number, source?: string): Promise<any>;
    getRateHistory(base: string, target: string, days: number): Promise<any>;
    getUserCurrencies(userId: string): Promise<any>;
    updateUserCurrencies(userId: string, base: string, secondary: string[]): Promise<any>;
    getSupportedCurrencies(): any;
}

export interface ICurrencyController {
    getLatestRates(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    convertCurrency(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateRate(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getRateHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getUserCurrencies(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateUserCurrencies(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getSupportedCurrencies(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

export function createCurrencyController(currencyService: ICurrencyService): ICurrencyController {
    return {
        async getLatestRates(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const baseCurrency = (req.query.base as string) || 'INR';
                const rates = await currencyService.getLatestRates(baseCurrency);
                res.json({ data: rates });
            } catch (error) {
                next(error);
            }
        },

        async convertCurrency(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const { amount, from, to } = req.query;

                if (!amount || !from || !to) {
                    res.status(400).json({
                        error: { code: 'VALIDATION_ERROR', message: 'amount, from, and to parameters are required' }
                    });
                    return;
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
        },

        async updateRate(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const { baseCurrency, targetCurrency, rate, source } = req.body;

                if (!baseCurrency || !targetCurrency || !rate) {
                    res.status(400).json({
                        error: { code: 'VALIDATION_ERROR', message: 'baseCurrency, targetCurrency, and rate are required' }
                    });
                    return;
                }

                const result = await currencyService.updateRate(baseCurrency, targetCurrency, rate, source);
                res.json({ data: result });
            } catch (error) {
                next(error);
            }
        },

        async getRateHistory(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const { base, target, days = '30' } = req.query;

                if (!base || !target) {
                    res.status(400).json({
                        error: { code: 'VALIDATION_ERROR', message: 'base and target parameters are required' }
                    });
                    return;
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
        },

        async getUserCurrencies(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const preferences = await currencyService.getUserCurrencies(userId);
                res.json({ data: preferences });
            } catch (error) {
                next(error);
            }
        },

        async updateUserCurrencies(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { baseCurrency, secondaryCurrencies } = req.body;

                await currencyService.updateUserCurrencies(userId, baseCurrency, secondaryCurrencies);
                res.json({ message: 'Currency preferences updated' });
            } catch (error) {
                next(error);
            }
        },

        async getSupportedCurrencies(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const currencies = currencyService.getSupportedCurrencies();
                res.json({ data: currencies });
            } catch (error) {
                next(error);
            }
        }
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { CurrencyService } from '../services/currency/currency.service';
const defaultController = createCurrencyController(new CurrencyService());

export const getLatestRates = defaultController.getLatestRates;
export const convertCurrency = defaultController.convertCurrency;
export const updateRate = defaultController.updateRate;
export const getRateHistory = defaultController.getRateHistory;
export const getUserCurrencies = defaultController.getUserCurrencies;
export const updateUserCurrencies = defaultController.updateUserCurrencies;
export const getSupportedCurrencies = defaultController.getSupportedCurrencies;

