/**
 * Currency Conversion Service
 * 
 * Handles conversion between currencies with rate tracking,
 * chain conversions, and proper error handling.
 */

import { ExchangeRateService, ExchangeRateResult } from '@shared/utils/currency/ExchangeRateService';
import { DEFAULT_CURRENCY, isCryptoCurrency } from '@shared/utils/currency/currencyDefinitions';

export interface ConversionResult {
    originalAmount: number;
    originalCurrency: string;
    convertedAmount: number;
    targetCurrency: string;
    conversionRate: number;
    rateSource: 'exchange-api' | 'fallback-json' | 'database' | 'none';
    rateDate?: string;
    conversionSkipped: boolean;
    skipReason?: 'unknown_currency' | 'rate_unavailable' | 'already_target' | 'invalid_amount' | 'crypto_rate_unavailable';
    chainedVia?: string;  // Intermediate currency if chain conversion used
}

export interface BatchConversionItem {
    amount: number;
    fromCurrency: string;
}

export interface BatchConversionResult {
    items: ConversionResult[];
    targetCurrency: string;
    totalConverted: number;
    failedCount: number;
}

/**
 * Currency Conversion Service
 */
export class CurrencyConversionService {
    private defaultTargetCurrency: string;

    constructor(defaultTarget: string = DEFAULT_CURRENCY) {
        this.defaultTargetCurrency = defaultTarget;
    }

    /**
     * Convert an amount from one currency to another
     */
    async convert(
        amount: number,
        fromCurrency: string | null,
        targetCurrency?: string
    ): Promise<ConversionResult> {
        const target = targetCurrency || this.defaultTargetCurrency;
        const from = fromCurrency?.toUpperCase() || DEFAULT_CURRENCY;
        const to = target.toUpperCase();

        // Validate amount
        if (!Number.isFinite(amount) || amount === 0) {
            return {
                originalAmount: amount,
                originalCurrency: from,
                convertedAmount: amount,
                targetCurrency: to,
                conversionRate: 0,
                rateSource: 'none',
                conversionSkipped: true,
                skipReason: 'invalid_amount',
            };
        }

        // Same currency - skip conversion
        if (from === to) {
            return {
                originalAmount: amount,
                originalCurrency: from,
                convertedAmount: amount,
                targetCurrency: to,
                conversionRate: 1,
                rateSource: 'none',
                conversionSkipped: true,
                skipReason: 'already_target',
            };
        }

        // Unknown source currency
        if (!fromCurrency) {
            return {
                originalAmount: amount,
                originalCurrency: from,
                convertedAmount: amount,
                targetCurrency: to,
                conversionRate: 0,
                rateSource: 'none',
                conversionSkipped: true,
                skipReason: 'unknown_currency',
            };
        }

        // Get exchange rate
        const rateResult = await ExchangeRateService.getRate(from, to);

        if (!rateResult.success) {
            // Try chain conversion via INR if not already involving INR
            if (from !== 'INR' && to !== 'INR') {
                const chainResult = await this.chainConvert(amount, from, to, 'INR');
                if (!chainResult.conversionSkipped) {
                    return chainResult;
                }
            }

            return {
                originalAmount: amount,
                originalCurrency: from,
                convertedAmount: amount,
                targetCurrency: to,
                conversionRate: 0,
                rateSource: 'none',
                conversionSkipped: true,
                skipReason: isCryptoCurrency(from) ? 'crypto_rate_unavailable' : 'rate_unavailable',
            };
        }

        // Perform conversion with single rounding at the end
        const convertedAmount = this.roundToDecimalPlaces(amount * rateResult.rate, 2);

        return {
            originalAmount: amount,
            originalCurrency: from,
            convertedAmount,
            targetCurrency: to,
            conversionRate: rateResult.rate,
            rateSource: rateResult.source,
            rateDate: rateResult.rateDate,
            conversionSkipped: false,
        };
    }

    /**
     * Chain conversion through an intermediate currency
     * Used when direct rate is unavailable
     */
    async chainConvert(
        amount: number,
        from: string,
        to: string,
        via: string
    ): Promise<ConversionResult> {
        const fromUpper = from.toUpperCase();
        const toUpper = to.toUpperCase();
        const viaUpper = via.toUpperCase();

        // Get rate from source to intermediate
        const rateToVia = await ExchangeRateService.getRate(fromUpper, viaUpper);
        if (!rateToVia.success) {
            return {
                originalAmount: amount,
                originalCurrency: fromUpper,
                convertedAmount: amount,
                targetCurrency: toUpper,
                conversionRate: 0,
                rateSource: 'none',
                conversionSkipped: true,
                skipReason: 'rate_unavailable',
            };
        }

        // Get rate from intermediate to target
        const rateFromVia = await ExchangeRateService.getRate(viaUpper, toUpper);
        if (!rateFromVia.success) {
            return {
                originalAmount: amount,
                originalCurrency: fromUpper,
                convertedAmount: amount,
                targetCurrency: toUpper,
                conversionRate: 0,
                rateSource: 'none',
                conversionSkipped: true,
                skipReason: 'rate_unavailable',
            };
        }

        // Calculate combined rate - single multiplication, then single rounding
        const combinedRate = rateToVia.rate * rateFromVia.rate;
        const convertedAmount = this.roundToDecimalPlaces(amount * combinedRate, 2);

        // Use the more "reliable" source
        const sourceOrder: Record<string, number> = {
            'exchange-api': 0,
            'database': 1,
            'fallback-json': 2,
        };
        const primarySource = sourceOrder[rateToVia.source] <= sourceOrder[rateFromVia.source]
            ? rateToVia.source
            : rateFromVia.source;

        return {
            originalAmount: amount,
            originalCurrency: fromUpper,
            convertedAmount,
            targetCurrency: toUpper,
            conversionRate: combinedRate,
            rateSource: primarySource,
            rateDate: rateToVia.rateDate || rateFromVia.rateDate,
            conversionSkipped: false,
            chainedVia: viaUpper,
        };
    }

    /**
     * Convert multiple amounts to a single target currency
     */
    async convertBatch(
        items: BatchConversionItem[],
        targetCurrency?: string
    ): Promise<BatchConversionResult> {
        const target = targetCurrency || this.defaultTargetCurrency;
        const results: ConversionResult[] = [];
        let totalConverted = 0;
        let failedCount = 0;

        for (const item of items) {
            const result = await this.convert(item.amount, item.fromCurrency, target);
            results.push(result);

            if (result.conversionSkipped) {
                failedCount++;
            } else {
                totalConverted += result.convertedAmount;
            }
        }

        return {
            items: results,
            targetCurrency: target,
            totalConverted: this.roundToDecimalPlaces(totalConverted, 2),
            failedCount,
        };
    }

    /**
     * Re-convert an amount using a new target currency
     * Useful when user changes display preference
     */
    async reconvert(
        originalAmount: number,
        originalCurrency: string,
        newTargetCurrency: string
    ): Promise<ConversionResult> {
        return this.convert(originalAmount, originalCurrency, newTargetCurrency);
    }

    /**
     * Get the current default target currency
     */
    getDefaultTargetCurrency(): string {
        return this.defaultTargetCurrency;
    }

    /**
     * Set a new default target currency
     */
    setDefaultTargetCurrency(currency: string): void {
        this.defaultTargetCurrency = currency.toUpperCase();
    }

    /**
     * Round to specific decimal places (banker's rounding avoided)
     */
    private roundToDecimalPlaces(value: number, places: number): number {
        const factor = Math.pow(10, places);
        return Math.round(value * factor) / factor;
    }

    /**
     * Create a formatted conversion summary for display
     */
    formatConversion(result: ConversionResult): string {
        if (result.conversionSkipped) {
            return `${result.originalCurrency} ${result.originalAmount.toFixed(2)} (conversion skipped: ${result.skipReason})`;
        }

        const chainInfo = result.chainedVia ? ` via ${result.chainedVia}` : '';
        return `${result.originalCurrency} ${result.originalAmount.toFixed(2)} → ${result.targetCurrency} ${result.convertedAmount.toFixed(2)} @ ${result.conversionRate.toFixed(4)}${chainInfo} [${result.rateSource}]`;
    }
}

/**
 * Singleton instance for common use
 */
export const currencyConverter = new CurrencyConversionService();
