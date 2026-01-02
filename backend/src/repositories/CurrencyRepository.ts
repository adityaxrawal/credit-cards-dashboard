/**
 * Currency Repository
 * Data access layer for currency rates and preferences
 */

import { query } from '../lib/db';

export interface CurrencyRateRow {
    id: string;
    base_currency: string;
    target_currency: string;
    rate: number;
    rate_date: string;
    source: string;
    created_at: Date;
}

export class CurrencyRepository {
    /**
     * Get latest rates for a base currency
     */
    static async getLatestRates(baseCurrency: string): Promise<CurrencyRateRow[]> {
        const result = await query(
            `SELECT DISTINCT ON (target_currency)
                id, base_currency, target_currency, rate, rate_date, source, created_at
             FROM currency_rates
             WHERE base_currency = $1
             ORDER BY target_currency, rate_date DESC`,
            [baseCurrency]
        );
        return result.rows;
    }

    /**
     * Get rate for a currency pair
     */
    static async getRate(baseCurrency: string, targetCurrency: string): Promise<CurrencyRateRow | null> {
        const result = await query(
            `SELECT rate, rate_date FROM currency_rates 
             WHERE base_currency = $1 AND target_currency = $2
             ORDER BY rate_date DESC LIMIT 1`,
            [baseCurrency, targetCurrency]
        );
        return result.rows[0] || null;
    }

    /**
     * Update or insert a rate
     */
    static async upsertRate(
        baseCurrency: string,
        targetCurrency: string,
        rate: number,
        rateDate: string,
        source: string
    ): Promise<CurrencyRateRow> {
        const result = await query(
            `INSERT INTO currency_rates (base_currency, target_currency, rate, rate_date, source)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (base_currency, target_currency, rate_date) 
             DO UPDATE SET rate = $3, source = $5
             RETURNING *`,
            [baseCurrency, targetCurrency, rate, rateDate, source]
        );
        return result.rows[0];
    }

    /**
     * Get rate history
     */
    static async getRateHistory(
        baseCurrency: string,
        targetCurrency: string,
        days: number
    ): Promise<CurrencyRateRow[]> {
        const result = await query(
            `SELECT * FROM currency_rates 
             WHERE base_currency = $1 AND target_currency = $2
             AND rate_date >= CURRENT_DATE - $3::interval
             ORDER BY rate_date DESC`,
            [baseCurrency, targetCurrency, `${days} days`]
        );
        return result.rows;
    }

    /**
     * Get user currency preferences
     */
    static async getUserCurrencies(userId: string): Promise<{ baseCurrency: string; secondaryCurrencies: string[] }> {
        const result = await query(
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
     * Update user currency preferences
     */
    static async updateUserCurrencies(
        userId: string,
        baseCurrency: string,
        secondaryCurrencies: string[]
    ): Promise<void> {
        await query(
            `UPDATE users SET base_currency = $1, secondary_currencies = $2 WHERE id = $3`,
            [baseCurrency, secondaryCurrencies || [], userId]
        );
    }
}
