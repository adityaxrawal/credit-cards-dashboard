import pool from '../../lib/db';

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
        const query = `
      SELECT DISTINCT ON (target_currency)
        id, base_currency, target_currency, rate, rate_date, source, created_at
      FROM currency_rates
      WHERE base_currency = $1
      ORDER BY target_currency, rate_date DESC
    `;

        const result = await pool.query(query, [baseCurrency]);
        return result.rows.map(row => this.mapRateRow(row));
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
        let rateResult = await pool.query(
            `SELECT rate, rate_date FROM currency_rates 
       WHERE base_currency = $1 AND target_currency = $2
       ORDER BY rate_date DESC LIMIT 1`,
            [fromCurrency, toCurrency]
        );

        if (rateResult.rows.length > 0) {
            const rate = parseFloat(rateResult.rows[0].rate);
            return {
                amount,
                convertedAmount: Math.round(amount * rate * 100) / 100,
                rate,
                rateDate: rateResult.rows[0].rate_date,
            };
        }

        // Try reverse conversion
        rateResult = await pool.query(
            `SELECT rate, rate_date FROM currency_rates 
       WHERE base_currency = $1 AND target_currency = $2
       ORDER BY rate_date DESC LIMIT 1`,
            [toCurrency, fromCurrency]
        );

        if (rateResult.rows.length > 0) {
            const rate = 1 / parseFloat(rateResult.rows[0].rate);
            return {
                amount,
                convertedAmount: Math.round(amount * rate * 100) / 100,
                rate,
                rateDate: rateResult.rows[0].rate_date,
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

        const result = await pool.query(
            `INSERT INTO currency_rates (base_currency, target_currency, rate, rate_date, source)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (base_currency, target_currency, rate_date) 
       DO UPDATE SET rate = $3, source = $5
       RETURNING *`,
            [baseCurrency, targetCurrency, rate, rateDate, source]
        );

        return this.mapRateRow(result.rows[0]);
    }

    /**
     * Get rate history for a currency pair
     */
    async getRateHistory(
        baseCurrency: string,
        targetCurrency: string,
        days: number = 30
    ): Promise<CurrencyRate[]> {
        const result = await pool.query(
            `SELECT * FROM currency_rates 
       WHERE base_currency = $1 AND target_currency = $2
       AND rate_date >= CURRENT_DATE - $3::interval
       ORDER BY rate_date DESC`,
            [baseCurrency, targetCurrency, `${days} days`]
        );

        return result.rows.map(row => this.mapRateRow(row));
    }

    /**
     * Get user's preferred currencies
     */
    async getUserCurrencies(userId: string): Promise<{ baseCurrency: string; secondaryCurrencies: string[] }> {
        const result = await pool.query(
            `SELECT base_currency, secondary_currencies FROM users WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return { baseCurrency: 'INR', secondaryCurrencies: [] };
        }

        return {
            baseCurrency: result.rows[0].base_currency || 'INR',
            secondaryCurrencies: result.rows[0].secondary_currencies || [],
        };
    }

    /**
     * Update user's preferred currencies
     */
    async updateUserCurrencies(
        userId: string,
        baseCurrency: string,
        secondaryCurrencies?: string[]
    ): Promise<void> {
        await pool.query(
            `UPDATE users SET base_currency = $1, secondary_currencies = $2 WHERE id = $3`,
            [baseCurrency, secondaryCurrencies || [], userId]
        );
    }

    /**
     * Get list of supported currencies
     */
    getSupportedCurrencies(): string[] {
        return this.supportedCurrencies;
    }

    private async getRate(from: string, to: string): Promise<number | null> {
        const result = await pool.query(
            `SELECT rate FROM currency_rates 
       WHERE base_currency = $1 AND target_currency = $2
       ORDER BY rate_date DESC LIMIT 1`,
            [from, to]
        );

        if (result.rows.length > 0) {
            return parseFloat(result.rows[0].rate);
        }

        // Try reverse
        const reverseResult = await pool.query(
            `SELECT rate FROM currency_rates 
       WHERE base_currency = $1 AND target_currency = $2
       ORDER BY rate_date DESC LIMIT 1`,
            [to, from]
        );

        if (reverseResult.rows.length > 0) {
            return 1 / parseFloat(reverseResult.rows[0].rate);
        }

        return null;
    }

    private mapRateRow(row: any): CurrencyRate {
        return {
            id: row.id,
            baseCurrency: row.base_currency,
            targetCurrency: row.target_currency,
            rate: parseFloat(row.rate),
            rateDate: row.rate_date,
            source: row.source,
            createdAt: row.created_at,
        };
    }
}
