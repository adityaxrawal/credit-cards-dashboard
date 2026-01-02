import { apiClient } from '@/lib/api-client';

// Types
export interface CurrencyRate {
    id: string;
    baseCurrency: string;
    targetCurrency: string;
    rate: number;
    rateDate: string;
    source: string;
    createdAt: string;
}

export interface ConversionResult {
    amount: number;
    convertedAmount: number;
    rate: number;
    rateDate: string;
}

export interface UserCurrencyPreferences {
    baseCurrency: string;
    secondaryCurrencies: string[];
}

// API Functions
export const currencyApi = {
    /**
     * Get supported currencies
     */
    getSupportedCurrencies: async (): Promise<string[]> => {
        const response = await apiClient.get<{ data: string[] }>('/api/currency/supported');
        return response.data.data;
    },

    /**
     * Get latest exchange rates
     */
    getLatestRates: async (baseCurrency?: string): Promise<CurrencyRate[]> => {
        const params = baseCurrency ? `?base=${baseCurrency}` : '';
        const response = await apiClient.get<{ data: CurrencyRate[] }>(`/api/currency/rates${params}`);
        return response.data.data;
    },

    /**
     * Get rate history for a currency pair
     */
    getRateHistory: async (baseCurrency: string, targetCurrency: string, days?: number): Promise<CurrencyRate[]> => {
        let params = `?base=${baseCurrency}&target=${targetCurrency}`;
        if (days) params += `&days=${days}`;
        const response = await apiClient.get<{ data: CurrencyRate[] }>(`/api/currency/rates/history${params}`);
        return response.data.data;
    },

    /**
     * Update exchange rate
     */
    updateRate: async (baseCurrency: string, targetCurrency: string, rate: number, source?: string): Promise<CurrencyRate> => {
        const response = await apiClient.post<{ data: CurrencyRate }>('/api/currency/rates', {
            baseCurrency,
            targetCurrency,
            rate,
            source,
        });
        return response.data.data;
    },

    /**
     * Convert amount between currencies
     */
    convert: async (amount: number, fromCurrency: string, toCurrency: string): Promise<ConversionResult> => {
        const response = await apiClient.get<{ data: ConversionResult }>(
            `/api/currency/convert?amount=${amount}&from=${fromCurrency}&to=${toCurrency}`
        );
        return response.data.data;
    },

    /**
     * Get user's currency preferences
     */
    getUserPreferences: async (): Promise<UserCurrencyPreferences> => {
        const response = await apiClient.get<{ data: UserCurrencyPreferences }>('/api/currency/preferences');
        return response.data.data;
    },

    /**
     * Update user's currency preferences
     */
    updateUserPreferences: async (baseCurrency: string, secondaryCurrencies?: string[]): Promise<void> => {
        await apiClient.put('/api/currency/preferences', { baseCurrency, secondaryCurrencies });
    },
};
