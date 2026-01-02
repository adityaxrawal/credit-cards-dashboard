import { CurrencyRepository, CurrencyRateRow } from '@modules/currency/currency.repository';
import { ExchangeRateService } from '@shared/utils/currency';

export interface CurrencyRate {
    id: string;
    baseCurrency: string;
    targetCurrency: string;
    rate: number;
    rateDate: string;
    source: string;
    createdAt: Date;
}

export class CurrencyService {
    private readonly supportedCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'CAD', 'AUD', 'JPY'];

    /**
     * Get latest exchange rates for a base currency
     */
    async getLatestRates(baseCurrency: string = 'INR'): Promise<CurrencyRate[]> {
        let rows = await CurrencyRepository.getLatestRates(baseCurrency);

        // If no rates found, try to fetch from external API
        if (rows.length === 0) {
            console.log(`[CurrencyService] No rates found for ${baseCurrency}, fetching from API...`);
            await ExchangeRateService.getAllRates(baseCurrency);
            // Re-fetch from DB (as getAllRates populates DB)
            rows = await CurrencyRepository.getLatestRates(baseCurrency);
        }

        return rows.map(row => this.mapRateRow(row));
    }

    /**
     * Convert amount between currencies
     */
    async convert(amount: number, fromCurrency: string, toCurrency: string): Promise<{
        amount: number;
        convertedAmount: number;
        rate: number;
        rateDate: string;
    }> {
        if (fromCurrency === toCurrency) {
            return { amount, convertedAmount: amount, rate: 1, rateDate: new Date().toISOString().split('T')[0] };
        }

        // Try direct conversion
        let rateRow = await CurrencyRepository.getRate(fromCurrency, toCurrency);

        if (rateRow) {
            const rate = parseFloat(String(rateRow.rate));
            return {
                amount,
                convertedAmount: Math.round(amount * rate * 100) / 100,
                rate,
                rateDate: rateRow.rate_date,
            };
        }

        // Try reverse conversion
        rateRow = await CurrencyRepository.getRate(toCurrency, fromCurrency);

        if (rateRow) {
            const rate = 1 / parseFloat(String(rateRow.rate));
            return {
                amount,
                convertedAmount: Math.round(amount * rate * 100) / 100,
                rate,
                rateDate: rateRow.rate_date,
            };
        }

        // Try conversion via INR
        const toINR = await this.getRate(fromCurrency, 'INR');
        const fromINR = await this.getRate('INR', toCurrency);

        if (toINR && fromINR) {
            const rate = toINR * fromINR;
            return {
                amount,
                convertedAmount: Math.round(amount * rate * 100) / 100,
                rate,
                rateDate: new Date().toISOString().split('T')[0],
            };
        }

        throw new Error(`Cannot find exchange rate for ${fromCurrency} to ${toCurrency}`);
    }

    /**
     * Update exchange rate (manual or from external source)
     */
    async updateRate(
        baseCurrency: string,
        targetCurrency: string,
        rate: number,
        source: string = 'manual'
    ): Promise<CurrencyRate> {
        const rateDate = new Date().toISOString().split('T')[0];
        const row = await CurrencyRepository.upsertRate(baseCurrency, targetCurrency, rate, rateDate, source);
        return this.mapRateRow(row);
    }

    /**
     * Get rate history for a currency pair
     */
    async getRateHistory(
        baseCurrency: string,
        targetCurrency: string,
        days: number = 30
    ): Promise<CurrencyRate[]> {
        const rows = await CurrencyRepository.getRateHistory(baseCurrency, targetCurrency, days);
        return rows.map(row => this.mapRateRow(row));
    }

    /**
     * Get user's preferred currencies
     */
    async getUserCurrencies(userId: string): Promise<{ baseCurrency: string; secondaryCurrencies: string[] }> {
        return CurrencyRepository.getUserCurrencies(userId);
    }

    /**
     * Update user's preferred currencies
     */
    async updateUserCurrencies(
        userId: string,
        baseCurrency: string,
        secondaryCurrencies?: string[]
    ): Promise<void> {
        await CurrencyRepository.updateUserCurrencies(userId, baseCurrency, secondaryCurrencies || []);
    }

    /**
     * Get list of supported currencies
     */
    getSupportedCurrencies(): string[] {
        return this.supportedCurrencies;
    }

    private async getRate(from: string, to: string): Promise<number | null> {
        const row = await CurrencyRepository.getRate(from, to);
        if (row) {
            return parseFloat(String(row.rate));
        }

        // Try reverse
        const reverseRow = await CurrencyRepository.getRate(to, from);
        if (reverseRow) {
            return 1 / parseFloat(String(reverseRow.rate));
        }

        return null;
    }

    private mapRateRow(row: CurrencyRateRow): CurrencyRate {
        return {
            id: row.id,
            baseCurrency: row.base_currency,
            targetCurrency: row.target_currency,
            rate: parseFloat(String(row.rate)),
            rateDate: row.rate_date,
            source: row.source,
            createdAt: row.created_at,
        };
    }
}
