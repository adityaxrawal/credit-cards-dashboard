/**
 * Currency Definitions
 * 
 * Core currency metadata including ISO codes, symbols, regex patterns,
 * and formatting rules for all supported currencies.
 */

export interface CurrencyDefinition {
    code: string;                    // ISO 4217 code (e.g., 'USD')
    symbol: string;                  // Primary symbol (e.g., '$')
    alternateSymbols: string[];      // Other valid symbols
    name: string;                    // Full name (e.g., 'US Dollar')
    isCrypto: boolean;               // Whether this is a cryptocurrency
    decimalSeparator: '.' | ',';     // Standard decimal separator
    thousandSeparator: ',' | '.' | "'" | ' ' | '';  // Grouping separator
    symbolPosition: 'before' | 'after';  // Where symbol appears
    decimalPlaces: number;           // Standard decimal places
    patterns: RegExp[];              // Regex patterns to detect this currency
}

/**
 * All supported fiat currencies
 */
export const FIAT_CURRENCIES: Record<string, CurrencyDefinition> = {
    INR: {
        code: 'INR',
        symbol: '₹',
        alternateSymbols: ['Rs', 'Rs.', 'Rupee', 'Rupees'],
        name: 'Indian Rupee',
        isCrypto: false,
        decimalSeparator: '.',
        thousandSeparator: ',',
        symbolPosition: 'before',
        decimalPlaces: 2,
        patterns: [
            /₹\s*[\d,]+(?:\.\d+)?/i,
            /Rs\.?\s*[\d,]+(?:\.\d+)?/i,
            /INR\s*[\d,]+(?:\.\d+)?/i,
            /[\d,]+(?:\.\d+)?\s*(?:INR|Rs\.?|₹)/i,
        ],
    },
    USD: {
        code: 'USD',
        symbol: '$',
        alternateSymbols: ['US$', 'Dollar', 'Dollars'],
        name: 'US Dollar',
        isCrypto: false,
        decimalSeparator: '.',
        thousandSeparator: ',',
        symbolPosition: 'before',
        decimalPlaces: 2,
        patterns: [
            /\$\s*[\d,]+(?:\.\d+)?/,
            /USD\s*[\d,]+(?:\.\d+)?/i,
            /US\$\s*[\d,]+(?:\.\d+)?/i,
            /[\d,]+(?:\.\d+)?\s*(?:USD|US\$)/i,
        ],
    },
    EUR: {
        code: 'EUR',
        symbol: '€',
        alternateSymbols: ['Euro', 'Euros'],
        name: 'Euro',
        isCrypto: false,
        decimalSeparator: ',',
        thousandSeparator: '.',
        symbolPosition: 'after',
        decimalPlaces: 2,
        patterns: [
            /€\s*[\d.,]+/,
            /EUR\s*[\d.,]+/i,
            /[\d.,]+\s*(?:EUR|€)/i,
        ],
    },
    GBP: {
        code: 'GBP',
        symbol: '£',
        alternateSymbols: ['Pound', 'Pounds', 'Sterling'],
        name: 'British Pound',
        isCrypto: false,
        decimalSeparator: '.',
        thousandSeparator: ',',
        symbolPosition: 'before',
        decimalPlaces: 2,
        patterns: [
            /£\s*[\d,]+(?:\.\d+)?/,
            /GBP\s*[\d,]+(?:\.\d+)?/i,
            /[\d,]+(?:\.\d+)?\s*(?:GBP|£)/i,
        ],
    },
    AED: {
        code: 'AED',
        symbol: 'د.إ',
        alternateSymbols: ['Dirham', 'Dirhams', 'DH'],
        name: 'UAE Dirham',
        isCrypto: false,
        decimalSeparator: '.',
        thousandSeparator: ',',
        symbolPosition: 'before',
        decimalPlaces: 2,
        patterns: [
            /AED\s*[\d,]+(?:\.\d+)?/i,
            /[\d,]+(?:\.\d+)?\s*AED/i,
        ],
    },
    SGD: {
        code: 'SGD',
        symbol: 'S$',
        alternateSymbols: ['Singapore Dollar'],
        name: 'Singapore Dollar',
        isCrypto: false,
        decimalSeparator: '.',
        thousandSeparator: ',',
        symbolPosition: 'before',
        decimalPlaces: 2,
        patterns: [
            /S\$\s*[\d,]+(?:\.\d+)?/,
            /SGD\s*[\d,]+(?:\.\d+)?/i,
            /[\d,]+(?:\.\d+)?\s*SGD/i,
        ],
    },
    CAD: {
        code: 'CAD',
        symbol: 'C$',
        alternateSymbols: ['CA$', 'Canadian Dollar'],
        name: 'Canadian Dollar',
        isCrypto: false,
        decimalSeparator: '.',
        thousandSeparator: ',',
        symbolPosition: 'before',
        decimalPlaces: 2,
        patterns: [
            /C\$\s*[\d,]+(?:\.\d+)?/,
            /CA\$\s*[\d,]+(?:\.\d+)?/,
            /CAD\s*[\d,]+(?:\.\d+)?/i,
            /[\d,]+(?:\.\d+)?\s*CAD/i,
        ],
    },
    AUD: {
        code: 'AUD',
        symbol: 'A$',
        alternateSymbols: ['AU$', 'Australian Dollar'],
        name: 'Australian Dollar',
        isCrypto: false,
        decimalSeparator: '.',
        thousandSeparator: ',',
        symbolPosition: 'before',
        decimalPlaces: 2,
        patterns: [
            /A\$\s*[\d,]+(?:\.\d+)?/,
            /AU\$\s*[\d,]+(?:\.\d+)?/,
            /AUD\s*[\d,]+(?:\.\d+)?/i,
            /[\d,]+(?:\.\d+)?\s*AUD/i,
        ],
    },
    JPY: {
        code: 'JPY',
        symbol: '¥',
        alternateSymbols: ['Yen', 'JP¥'],
        name: 'Japanese Yen',
        isCrypto: false,
        decimalSeparator: '.',
        thousandSeparator: ',',
        symbolPosition: 'before',
        decimalPlaces: 0,
        patterns: [
            /¥\s*[\d,]+/,
            /JPY\s*[\d,]+/i,
            /[\d,]+\s*(?:JPY|¥)/i,
        ],
    },
    CHF: {
        code: 'CHF',
        symbol: 'CHF',
        alternateSymbols: ['Fr.', 'Swiss Franc'],
        name: 'Swiss Franc',
        isCrypto: false,
        decimalSeparator: '.',
        thousandSeparator: "'",
        symbolPosition: 'before',
        decimalPlaces: 2,
        patterns: [
            /CHF\s*[\d',]+(?:\.\d+)?/i,
            /Fr\.\s*[\d',]+(?:\.\d+)?/i,
            /[\d',]+(?:\.\d+)?\s*CHF/i,
        ],
    },
    CNY: {
        code: 'CNY',
        symbol: '¥',
        alternateSymbols: ['Yuan', 'RMB', 'CN¥'],
        name: 'Chinese Yuan',
        isCrypto: false,
        decimalSeparator: '.',
        thousandSeparator: ',',
        symbolPosition: 'before',
        decimalPlaces: 2,
        patterns: [
            /CNY\s*[\d,]+(?:\.\d+)?/i,
            /RMB\s*[\d,]+(?:\.\d+)?/i,
            /[\d,]+(?:\.\d+)?\s*(?:CNY|RMB)/i,
        ],
    },
    HKD: {
        code: 'HKD',
        symbol: 'HK$',
        alternateSymbols: ['Hong Kong Dollar'],
        name: 'Hong Kong Dollar',
        isCrypto: false,
        decimalSeparator: '.',
        thousandSeparator: ',',
        symbolPosition: 'before',
        decimalPlaces: 2,
        patterns: [
            /HK\$\s*[\d,]+(?:\.\d+)?/,
            /HKD\s*[\d,]+(?:\.\d+)?/i,
            /[\d,]+(?:\.\d+)?\s*HKD/i,
        ],
    },
    NZD: {
        code: 'NZD',
        symbol: 'NZ$',
        alternateSymbols: ['New Zealand Dollar'],
        name: 'New Zealand Dollar',
        isCrypto: false,
        decimalSeparator: '.',
        thousandSeparator: ',',
        symbolPosition: 'before',
        decimalPlaces: 2,
        patterns: [
            /NZ\$\s*[\d,]+(?:\.\d+)?/,
            /NZD\s*[\d,]+(?:\.\d+)?/i,
            /[\d,]+(?:\.\d+)?\s*NZD/i,
        ],
    },
    THB: {
        code: 'THB',
        symbol: '฿',
        alternateSymbols: ['Baht'],
        name: 'Thai Baht',
        isCrypto: false,
        decimalSeparator: '.',
        thousandSeparator: ',',
        symbolPosition: 'before',
        decimalPlaces: 2,
        patterns: [
            /฿\s*[\d,]+(?:\.\d+)?/,
            /THB\s*[\d,]+(?:\.\d+)?/i,
            /[\d,]+(?:\.\d+)?\s*(?:THB|Baht)/i,
        ],
    },
    MYR: {
        code: 'MYR',
        symbol: 'RM',
        alternateSymbols: ['Ringgit'],
        name: 'Malaysian Ringgit',
        isCrypto: false,
        decimalSeparator: '.',
        thousandSeparator: ',',
        symbolPosition: 'before',
        decimalPlaces: 2,
        patterns: [
            /RM\s*[\d,]+(?:\.\d+)?/,
            /MYR\s*[\d,]+(?:\.\d+)?/i,
            /[\d,]+(?:\.\d+)?\s*(?:MYR|RM)/i,
        ],
    },
};

/**
 * Supported cryptocurrency definitions
 */
export const CRYPTO_CURRENCIES: Record<string, CurrencyDefinition> = {
    BTC: {
        code: 'BTC',
        symbol: '₿',
        alternateSymbols: ['Bitcoin', 'Bitcoins'],
        name: 'Bitcoin',
        isCrypto: true,
        decimalSeparator: '.',
        thousandSeparator: ',',
        symbolPosition: 'before',
        decimalPlaces: 8,
        patterns: [
            /₿\s*[\d.]+/,
            /BTC\s*[\d.]+/i,
            /[\d.]+\s*BTC/i,
            /[\d.]+\s*Bitcoin/i,
        ],
    },
    ETH: {
        code: 'ETH',
        symbol: 'Ξ',
        alternateSymbols: ['Ethereum', 'Ether'],
        name: 'Ethereum',
        isCrypto: true,
        decimalSeparator: '.',
        thousandSeparator: ',',
        symbolPosition: 'before',
        decimalPlaces: 18,
        patterns: [
            /Ξ\s*[\d.]+/,
            /ETH\s*[\d.]+/i,
            /[\d.]+\s*ETH/i,
            /[\d.]+\s*Ethereum/i,
        ],
    },
    USDT: {
        code: 'USDT',
        symbol: '₮',
        alternateSymbols: ['Tether'],
        name: 'Tether',
        isCrypto: true,
        decimalSeparator: '.',
        thousandSeparator: ',',
        symbolPosition: 'before',
        decimalPlaces: 6,
        patterns: [
            /USDT\s*[\d.]+/i,
            /[\d.]+\s*USDT/i,
            /[\d.]+\s*Tether/i,
        ],
    },
    USDC: {
        code: 'USDC',
        symbol: 'USDC',
        alternateSymbols: ['USD Coin'],
        name: 'USD Coin',
        isCrypto: true,
        decimalSeparator: '.',
        thousandSeparator: ',',
        symbolPosition: 'before',
        decimalPlaces: 6,
        patterns: [
            /USDC\s*[\d.]+/i,
            /[\d.]+\s*USDC/i,
        ],
    },
};

/**
 * All supported currencies (fiat + crypto)
 */
export const ALL_CURRENCIES: Record<string, CurrencyDefinition> = {
    ...FIAT_CURRENCIES,
    ...CRYPTO_CURRENCIES,
};

/**
 * Symbol to currency code mapping for quick lookup
 * Note: Some symbols like $ and ¥ are ambiguous
 */
export const SYMBOL_TO_CURRENCY: Record<string, string[]> = {
    '₹': ['INR'],
    '$': ['USD', 'CAD', 'AUD', 'SGD', 'HKD', 'NZD'],  // Ambiguous
    '€': ['EUR'],
    '£': ['GBP'],
    '¥': ['JPY', 'CNY'],  // Ambiguous
    '₿': ['BTC'],
    'Ξ': ['ETH'],
    '฿': ['THB'],
    '₮': ['USDT'],
};

/**
 * ISO code prefixes for disambiguation
 */
export const ISO_CODE_PATTERN = /\b(INR|USD|EUR|GBP|AED|SGD|CAD|AUD|JPY|CHF|CNY|HKD|NZD|THB|MYR|BTC|ETH|USDT|USDC)\b/i;

/**
 * Get currency definition by code
 */
export function getCurrencyByCode(code: string): CurrencyDefinition | null {
    const upperCode = code.toUpperCase();
    return ALL_CURRENCIES[upperCode] || null;
}

/**
 * Get possible currencies for a symbol
 */
export function getCurrenciesBySymbol(symbol: string): CurrencyDefinition[] {
    const codes = SYMBOL_TO_CURRENCY[symbol];
    if (!codes) return [];
    return codes.map(code => ALL_CURRENCIES[code]).filter(Boolean);
}

/**
 * Check if a currency code is valid
 */
export function isValidCurrencyCode(code: string): boolean {
    return code.toUpperCase() in ALL_CURRENCIES;
}

/**
 * Check if a currency is cryptocurrency
 */
export function isCryptoCurrency(code: string): boolean {
    const currency = getCurrencyByCode(code);
    return currency?.isCrypto ?? false;
}

/**
 * Default currency for the application
 */
export const DEFAULT_CURRENCY = 'INR';

/**
 * List of all supported currency codes
 */
export const SUPPORTED_CURRENCY_CODES = Object.keys(ALL_CURRENCIES);

/**
 * List of fiat currency codes only
 */
export const FIAT_CURRENCY_CODES = Object.keys(FIAT_CURRENCIES);

/**
 * List of crypto currency codes only
 */
export const CRYPTO_CURRENCY_CODES = Object.keys(CRYPTO_CURRENCIES);
