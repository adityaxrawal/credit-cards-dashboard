/**
 * Exchange Rate Service
 * 
 * Fetches exchange rates from external API with fallback to local JSON
 * and database caching.
 */

import NodeCache from 'node-cache';
import { CurrencyRepository } from '@modules/currency/currency.repository';
import fallbackRates from './fallbackRates.json';
import { DEFAULT_CURRENCY, isValidCurrencyCode, isCryptoCurrency } from './currencyDefinitions';

const API_BASE_URL = 'https://latest.currency-api.pages.dev/v1/currencies';
const CACHE_TTL_SECONDS = 300; // 5 minutes
const API_TIMEOUT_MS = 5000;

export interface ExchangeRateResult {
    rate: number;
    rateDate: string;
    source: 'exchange-api' | 'fallback-json' | 'database';
    fromCurrency: string;
    toCurrency: string;
    success: boolean;
    error?: string;
}

/**
 * In-memory rate cache
 */
const rateCache = new NodeCache({
    stdTTL: CACHE_TTL_SECONDS,
    checkperiod: 120,
    useClones: false,
});

/**
 * Generate cache key for a currency pair
 */
function getCacheKey(from: string, to: string): string {
    return `rate:${from.toLowerCase()}:${to.toLowerCase()}`;
}

/**
 * Exchange Rate Service
 */
export class ExchangeRateService {
    /**
     * Get exchange rate between two currencies
     * Priority: Cache -> API -> Fallback JSON -> Database
     */
    static async getRate(from: string, to: string): Promise<ExchangeRateResult> {
        const fromUpper = from.toUpperCase();
        const toUpper = to.toUpperCase();

        // Same currency - no conversion needed
        if (fromUpper === toUpper) {
            return {
                rate: 1,
                rateDate: new Date().toISOString().split('T')[0],
                source: 'exchange-api',
                fromCurrency: fromUpper,
                toCurrency: toUpper,
                success: true,
            };
        }

        // Validate currencies
        if (!isValidCurrencyCode(fromUpper)) {
            return {
                rate: 0,
                rateDate: '',
                source: 'fallback-json',
                fromCurrency: fromUpper,
                toCurrency: toUpper,
                success: false,
                error: `Unknown source currency: ${fromUpper}`,
            };
        }

        if (!isValidCurrencyCode(toUpper)) {
            return {
                rate: 0,
                rateDate: '',
                source: 'fallback-json',
                fromCurrency: fromUpper,
                toCurrency: toUpper,
                success: false,
                error: `Unknown target currency: ${toUpper}`,
            };
        }

        // Check cache first
        const cacheKey = getCacheKey(fromUpper, toUpper);
        const cached = rateCache.get<ExchangeRateResult>(cacheKey);
        if (cached) {
            return cached;
        }

        // Try external API
        try {
            const apiResult = await this.fetchFromAPI(fromUpper, toUpper);
            if (apiResult.success) {
                rateCache.set(cacheKey, apiResult);
                // Store in database for history
                await this.cacheToDatabase(fromUpper, toUpper, apiResult.rate, 'exchange-api');
                return apiResult;
            }
        } catch (error) {
            console.warn(`[ExchangeRateService] API fetch failed: ${error}`);
        }

        // Fallback to local JSON
        const fallbackResult = this.getFallbackRate(fromUpper, toUpper);
        if (fallbackResult) {
            const result: ExchangeRateResult = {
                rate: fallbackResult,
                rateDate: (fallbackRates.meta as any).lastUpdated || new Date().toISOString().split('T')[0],
                source: 'fallback-json',
                fromCurrency: fromUpper,
                toCurrency: toUpper,
                success: true,
            };
            rateCache.set(cacheKey, result);
            return result;
        }

        // Last resort: check database
        try {
            const dbRate = await CurrencyRepository.getRate(fromUpper, toUpper);
            if (dbRate && parseFloat(String(dbRate.rate)) > 0) {
                const result: ExchangeRateResult = {
                    rate: parseFloat(String(dbRate.rate)),
                    rateDate: dbRate.rate_date,
                    source: 'database',
                    fromCurrency: fromUpper,
                    toCurrency: toUpper,
                    success: true,
                };
                rateCache.set(cacheKey, result);
                return result;
            }
        } catch (error) {
            console.warn(`[ExchangeRateService] Database fetch failed: ${error}`);
        }

        // Complete failure
        return {
            rate: 0,
            rateDate: '',
            source: 'fallback-json',
            fromCurrency: fromUpper,
            toCurrency: toUpper,
            success: false,
            error: `No exchange rate available for ${fromUpper} to ${toUpper}`,
        };
    }

    /**
     * Fetch rate from external API
     */
    private static async fetchFromAPI(from: string, to: string): Promise<ExchangeRateResult> {
        const fromLower = from.toLowerCase();
        const toLower = to.toLowerCase();
        const url = `${API_BASE_URL}/${fromLower}.json`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                },
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            const data = await response.json();

            // API returns { "usd": { "inr": 83.5, "eur": 0.92, ... } }
            const rates = data[fromLower];
            if (!rates || typeof rates[toLower] !== 'number') {
                throw new Error(`Missing rate for ${to} in API response`);
            }

            const rate = rates[toLower];

            // Validate rate
            if (rate <= 0 || !Number.isFinite(rate)) {
                throw new Error(`Invalid rate value: ${rate}`);
            }

            return {
                rate,
                rateDate: new Date().toISOString().split('T')[0],
                source: 'exchange-api',
                fromCurrency: from.toUpperCase(),
                toCurrency: to.toUpperCase(),
                success: true,
            };
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Get rate from fallback JSON
     */
    private static getFallbackRate(from: string, to: string): number | null {
        const fromUpper = from.toUpperCase();
        const toUpper = to.toUpperCase();
        const rates = (fallbackRates as any).rates;

        // Direct rate
        if (rates[fromUpper] && typeof rates[fromUpper][toUpper] === 'number') {
            return rates[fromUpper][toUpper];
        }

        // Try reverse rate
        if (rates[toUpper] && typeof rates[toUpper][fromUpper] === 'number') {
            const reverseRate = rates[toUpper][fromUpper];
            if (reverseRate > 0) {
                return 1 / reverseRate;
            }
        }

        // Try via INR (chain conversion)
        if (fromUpper !== 'INR' && toUpper !== 'INR') {
            const fromToINR = rates[fromUpper]?.INR;
            const inrToTarget = rates['INR']?.[toUpper];

            if (typeof fromToINR === 'number' && fromToINR > 0) {
                // We have FROM -> INR, now need INR -> TO
                const targetFromINR = rates[toUpper]?.INR;
                if (typeof targetFromINR === 'number' && targetFromINR > 0) {
                    // INR -> TO = 1 / (TO -> INR)
                    return fromToINR / targetFromINR;
                }
            }
        }

        return null;
    }

    /**
     * Cache rate to database for historical tracking
     */
    private static async cacheToDatabase(
        from: string,
        to: string,
        rate: number,
        source: string
    ): Promise<void> {
        try {
            const rateDate = new Date().toISOString().split('T')[0];
            await CurrencyRepository.upsertRate(from, to, rate, rateDate, source);
        } catch (error) {
            // Non-critical - just log and continue
            console.warn(`[ExchangeRateService] Failed to cache rate to DB: ${error}`);
        }
    }

    /**
     * Get rates for multiple currency pairs at once
     */
    static async getRates(
        baseCurrency: string,
        targetCurrencies: string[]
    ): Promise<Map<string, ExchangeRateResult>> {
        const results = new Map<string, ExchangeRateResult>();

        await Promise.all(
            targetCurrencies.map(async (target) => {
                const result = await this.getRate(baseCurrency, target);
                results.set(target, result);
            })
        );

        return results;
    }

    /**
     * Clear the rate cache (useful for testing)
     */
    static clearCache(): void {
        rateCache.flushAll();
    }

    /**
     * Get cache statistics
     */
    static getCacheStats(): { keys: number; hits: number; misses: number } {
        const stats = rateCache.getStats();
        return {
            keys: rateCache.keys().length,
            hits: stats.hits,
            misses: stats.misses,
        };
    }
}
