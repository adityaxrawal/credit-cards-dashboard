'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { currencyApi } from '@/shared/utils/currency';
import { setDisplayCurrency as setGlobalDisplayCurrency } from '@/shared/utils';

/**
 * Supported currencies type
 */
export type Currency = 
  | 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD' 
  | 'CAD' | 'AUD' | 'JPY' | 'CHF' | 'CNY' | 'HKD'
  | 'NZD' | 'THB' | 'MYR';

/**
 * Currency metadata
 */
export interface CurrencyInfo {
  code: Currency;
  symbol: string;
  name: string;
  locale: string;
  decimalPlaces: number;
}

/**
 * All supported currencies with metadata
 */
export const CURRENCIES: Record<Currency, CurrencyInfo> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN', decimalPlaces: 0 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US', decimalPlaces: 2 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE', decimalPlaces: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB', decimalPlaces: 2 },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE', decimalPlaces: 2 },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG', decimalPlaces: 2 },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA', decimalPlaces: 2 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU', decimalPlaces: 2 },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP', decimalPlaces: 0 },
  CHF: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH', decimalPlaces: 2 },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN', decimalPlaces: 2 },
  HKD: { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', locale: 'zh-HK', decimalPlaces: 2 },
  NZD: { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', locale: 'en-NZ', decimalPlaces: 2 },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', locale: 'th-TH', decimalPlaces: 2 },
  MYR: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', locale: 'ms-MY', decimalPlaces: 2 },
};

/**
 * In-memory rate cache for frontend
 */
const rateCache = new Map<string, { rate: number; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CurrencyContextType {
  /** Current display currency */
  currency: Currency;
  
  /** Change the display currency */
  setCurrency: (c: Currency) => void;
  
  /** Format a number in the current display currency */
  format: (amount: number) => string;
  
  /** Format with explicit currency */
  formatAs: (amount: number, currencyCode: Currency) => string;
  
  /** Convert and format - converts from source currency to display currency */
  convertAndFormat: (amount: number, fromCurrency: string) => Promise<string>;
  
  /** Get conversion rate between two currencies */
  getRate: (from: string, to: string) => Promise<number>;
  
  /** Get all supported currencies */
  supportedCurrencies: CurrencyInfo[];
  
  /** Whether conversion rates are loading */
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

interface CurrencyProviderProps {
  children: ReactNode;
  defaultCurrency?: Currency;
}

export function CurrencyProvider({ children, defaultCurrency = 'INR' }: CurrencyProviderProps) {
  const [currency, setCurrencyState] = useState<Currency>(defaultCurrency);
  const [isLoading, setIsLoading] = useState(false);

  // Sync global formatCurrency store when currency changes
  useEffect(() => {
    setGlobalDisplayCurrency(currency);
  }, [currency]);

  // Load user preference from API on mount
  useEffect(() => {
    const loadPreference = async () => {
      try {
        const prefs = await currencyApi.getUserPreferences();
        if (prefs.baseCurrency && prefs.baseCurrency in CURRENCIES) {
          setCurrencyState(prefs.baseCurrency as Currency);
          // Also sync to global store immediately
          setGlobalDisplayCurrency(prefs.baseCurrency);
        }
      } catch (error) {
        console.warn('Failed to load currency preference:', error);
      }
    };
    loadPreference();
  }, []);

  // Persist currency changes to API
  const setCurrency = useCallback(async (c: Currency) => {
    setCurrencyState(c);
    try {
      await currencyApi.updateUserPreferences(c);
    } catch (error) {
      console.warn('Failed to save currency preference:', error);
    }
  }, []);

  // Format amount in the current display currency
  const format = useCallback((amount: number): string => {
    const info = CURRENCIES[currency];
    return new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: info.decimalPlaces,
      minimumFractionDigits: info.decimalPlaces,
    }).format(amount);
  }, [currency]);

  // Format amount in a specific currency
  const formatAs = useCallback((amount: number, currencyCode: Currency): string => {
    const info = CURRENCIES[currencyCode] || CURRENCIES.INR;
    return new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: info.decimalPlaces,
      minimumFractionDigits: info.decimalPlaces,
    }).format(amount);
  }, []);

  // Get exchange rate with caching
  const getRate = useCallback(async (from: string, to: string): Promise<number> => {
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    if (fromUpper === toUpper) return 1;

    const cacheKey = `${fromUpper}:${toUpper}`;
    const cached = rateCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.rate;
    }

    try {
      setIsLoading(true);
      const result = await currencyApi.convert(1, fromUpper, toUpper);
      const rate = result.rate;
      
      rateCache.set(cacheKey, { rate, timestamp: Date.now() });
      return rate;
    } catch (error) {
      console.error('Failed to get exchange rate:', error);
      // Check reverse cache
      const reverseKey = `${toUpper}:${fromUpper}`;
      const reverseCached = rateCache.get(reverseKey);
      if (reverseCached) {
        return 1 / reverseCached.rate;
      }
      return 1; // Fallback - no conversion
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Convert and format in one step
  const convertAndFormat = useCallback(async (amount: number, fromCurrency: string): Promise<string> => {
    const from = fromCurrency.toUpperCase();
    
    if (from === currency) {
      return format(amount);
    }

    try {
      const rate = await getRate(from, currency);
      const converted = amount * rate;
      return format(converted);
    } catch {
      // If conversion fails, format in original currency
      if (from in CURRENCIES) {
        return formatAs(amount, from as Currency);
      }
      return `${from} ${amount.toFixed(2)}`;
    }
  }, [currency, format, formatAs, getRate]);

  const supportedCurrencies = Object.values(CURRENCIES);

  return (
    <CurrencyContext.Provider 
      value={{ 
        currency, 
        setCurrency, 
        format, 
        formatAs,
        convertAndFormat, 
        getRate,
        supportedCurrencies,
        isLoading,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within CurrencyProvider');
  return context;
}

export function CurrencySelector() {
  const { currency, setCurrency, supportedCurrencies } = useCurrency();
  
  return (
    <select 
      value={currency} 
      onChange={(e) => setCurrency(e.target.value as Currency)}
      className="bg-transparent border-none text-xs font-medium text-secondary-text focus:ring-0 cursor-pointer"
    >
      {supportedCurrencies.map((c) => (
        <option key={c.code} value={c.code}>
          {c.symbol} {c.code}
        </option>
      ))}
    </select>
  );
}

/**
 * Compact currency selector for tight spaces
 */
export function CurrencyBadge() {
  const { currency, format } = useCurrency();
  const info = CURRENCIES[currency];
  
  return (
    <span className="inline-flex items-center gap-1 text-xs text-secondary-text">
      <span className="font-medium">{info.symbol}</span>
      <span>{currency}</span>
    </span>
  );
}

/**
 * Hook for formatting with automatic currency detection
 */
export function useFormatAmount() {
  const { format, formatAs, convertAndFormat, currency } = useCurrency();
  
  return {
    format,
    formatAs,
    convertAndFormat,
    displayCurrency: currency,
  };
}
