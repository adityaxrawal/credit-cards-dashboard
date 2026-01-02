import logger from '@shared/utils/infrastructure/logger';

/**
 * Parsed amount result
 */
export interface ParsedAmount {
    amount: number;
    currency: string;
    originalText: string;
    isForeignCurrency: boolean;
    fxRate?: number;
    confidence: number;
}

/**
 * EdgeCaseHandler - Handles special parsing scenarios
 * 
 * Covers:
 * - Amounts in words
 * - FX rate extraction
 * - Localized number formats (lakhs, crores)
 * - Missing currency symbols
 * - AMEX/Indian-specific formats
 * - Negative amounts vs reversals
 */
export class EdgeCaseHandler {
    // Currency symbols and codes
    private static readonly CURRENCY_MAP: Record<string, string> = {
        '₹': 'INR', 'Rs': 'INR', 'Rs.': 'INR', 'INR': 'INR', 'र': 'INR',
        '$': 'USD', 'USD': 'USD', 'US$': 'USD',
        '€': 'EUR', 'EUR': 'EUR',
        '£': 'GBP', 'GBP': 'GBP',
        '¥': 'JPY', 'JPY': 'JPY',
        'AED': 'AED', 'SGD': 'SGD', 'HKD': 'HKD', 'CAD': 'CAD', 'AUD': 'AUD',
    };

    // Number words (Indian English)
    private static readonly NUMBER_WORDS: Record<string, number> = {
        'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
        'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
        'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13,
        'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17,
        'eighteen': 18, 'nineteen': 19, 'twenty': 20, 'thirty': 30,
        'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
        'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000,
        'lakh': 100000, 'lac': 100000, 'lakhs': 100000,
        'crore': 10000000, 'crores': 10000000,
    };

    /**
     * Parse amount including edge cases
     */
    static parseAmount(text: string): ParsedAmount | null {
        // Try standard numeric parsing first
        const standard = this.parseStandardAmount(text);
        if (standard && standard.confidence > 0.7) {
            return standard;
        }

        // Try amount in words
        const wordsAmount = this.parseAmountInWords(text);
        if (wordsAmount) {
            return wordsAmount;
        }

        // Try Indian format with lakhs/crores
        const indianFormat = this.parseIndianFormat(text);
        if (indianFormat) {
            return indianFormat;
        }

        return standard;
    }

    /**
     * Parse standard numeric amount
     */
    private static parseStandardAmount(text: string): ParsedAmount | null {
        // Pattern for currency + amount with various formats
        const patterns: RegExp[] = [
            // ₹1,23,456.78 (Indian format)
            /([₹$€£¥]|Rs\.?|INR|USD|EUR|GBP|AED)\s*([\d,]+(?:\.\d{1,2})?)/i,
            // 1,23,456.78 INR (currency after)
            /([\d,]+(?:\.\d{1,2})?)\s*([₹$€£¥]|Rs\.?|INR|USD|EUR|GBP|AED)/i,
            // Plain number with rupees mentioned
            /(?:rupees?|amount)[:\s]*([\d,]+(?:\.\d{1,2})?)/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                let amountStr: string;
                let currencyStr: string;

                if (match[1] && this.isCurrencySymbol(match[1])) {
                    currencyStr = match[1];
                    amountStr = match[2];
                } else if (match[2] && this.isCurrencySymbol(match[2])) {
                    amountStr = match[1];
                    currencyStr = match[2];
                } else {
                    amountStr = match[1];
                    currencyStr = 'INR'; // Default
                }

                const amount = this.normalizeNumber(amountStr);
                const currency = this.CURRENCY_MAP[currencyStr.replace('.', '')] || 'INR';

                if (!isNaN(amount) && amount > 0) {
                    return {
                        amount,
                        currency,
                        originalText: match[0],
                        isForeignCurrency: currency !== 'INR',
                        confidence: 0.9
                    };
                }
            }
        }

        return null;
    }

    /**
     * Check if string is a currency symbol/code
     */
    private static isCurrencySymbol(str: string): boolean {
        return Object.keys(this.CURRENCY_MAP).includes(str.replace('.', ''));
    }

    /**
     * Normalize number string (handle Indian comma format)
     */
    private static normalizeNumber(str: string): number {
        // Remove all commas and parse
        return parseFloat(str.replace(/,/g, ''));
    }

    /**
     * Parse amount written in words
     * E.g., "Rupees Five Thousand Only", "Rs. Twenty Three Hundred"
     */
    private static parseAmountInWords(text: string): ParsedAmount | null {
        // Pattern to find amount in words section
        const amountWordsPattern = /(?:rupees?|rs\.?|inr)\s+([\w\s]+?)(?:\s+only|\s+and|\s+paise|$)/i;
        const match = text.match(amountWordsPattern);

        if (!match) return null;

        const wordsStr = match[1].toLowerCase().trim();
        const amount = this.wordsToNumber(wordsStr);

        if (amount > 0) {
            return {
                amount,
                currency: 'INR',
                originalText: match[0],
                isForeignCurrency: false,
                confidence: 0.7
            };
        }

        return null;
    }

    /**
     * Convert words to number
     */
    private static wordsToNumber(wordsStr: string): number {
        const words = wordsStr.split(/\s+/);
        let result = 0;
        let current = 0;

        for (const word of words) {
            const value = this.NUMBER_WORDS[word];
            if (value === undefined) continue;

            if (value === 100) {
                current = current === 0 ? 100 : current * 100;
            } else if (value === 1000) {
                current = current === 0 ? 1000 : current * 1000;
                result += current;
                current = 0;
            } else if (value >= 100000) {
                current = current === 0 ? value : current * value;
                result += current;
                current = 0;
            } else {
                current += value;
            }
        }

        return result + current;
    }

    /**
     * Parse Indian lakh/crore format
     * E.g., "1.5 Lakhs", "2 Crores"
     */
    private static parseIndianFormat(text: string): ParsedAmount | null {
        // Pattern for lakhs/crores
        const pattern = /([\d.]+)\s*(lakhs?|lacs?|crores?)/i;
        const match = text.match(pattern);

        if (match) {
            const value = parseFloat(match[1]);
            const multiplier = match[2].toLowerCase().startsWith('cr') ? 10000000 : 100000;
            const amount = value * multiplier;

            return {
                amount,
                currency: 'INR',
                originalText: match[0],
                isForeignCurrency: false,
                confidence: 0.85
            };
        }

        return null;
    }

    /**
     * Extract FX rate from text
     */
    static extractFxRate(text: string): { rate: number; fromCurrency: string; toCurrency: string } | null {
        const patterns: RegExp[] = [
            // "Rate: 83.50 USD/INR"
            /rate[:\s]*([\d.]+)\s*([A-Z]{3})\s*[\/\-to]\s*([A-Z]{3})/i,
            // "Conversion rate: 83.50"
            /conversion\s+rate[:\s]*([\d.]+)/i,
            // "1 USD = 83.50 INR"
            /1\s*([A-Z]{3})\s*=\s*([\d.]+)\s*([A-Z]{3})/i,
            // "Exchange rate @ 83.50"
            /exchange\s+rate\s*[@:]\s*([\d.]+)/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                if (match[3]) {
                    // Pattern with currency codes
                    return {
                        rate: parseFloat(match[2] || match[1]),
                        fromCurrency: match[1] || 'USD',
                        toCurrency: match[3] || 'INR'
                    };
                } else {
                    // Just rate number
                    return {
                        rate: parseFloat(match[1]),
                        fromCurrency: 'USD',
                        toCurrency: 'INR'
                    };
                }
            }
        }

        return null;
    }

    /**
     * Determine if amount is negative (reversal) vs credit
     */
    static isNegativeVsReversal(
        amount: number,
        text: string
    ): { isNegative: boolean; isReversal: boolean; direction: 'debit' | 'credit' } {
        const reversalIndicators = [
            /reversal/i,
            /reversed/i,
            /refund/i,
            /cancelled/i,
            /failed\s+(?:transaction|txn)/i,
        ];

        const creditIndicators = [
            /credited/i,
            /received/i,
            /deposited/i,
            /credit\s+(?:to|in)/i,
        ];

        const isReversal = reversalIndicators.some(p => p.test(text));
        const isCredit = creditIndicators.some(p => p.test(text));

        if (amount < 0) {
            return { isNegative: true, isReversal, direction: 'credit' };
        }

        if (isReversal) {
            return { isNegative: false, isReversal: true, direction: 'credit' };
        }

        if (isCredit) {
            return { isNegative: false, isReversal: false, direction: 'credit' };
        }

        return { isNegative: false, isReversal: false, direction: 'debit' };
    }

    /**
     * Normalize timezone to IST
     */
    static normalizeToIST(date: Date, sourceTimezone?: string): Date {
        // If source timezone is provided and different from IST, convert
        if (sourceTimezone && sourceTimezone !== 'IST' && sourceTimezone !== 'Asia/Kolkata') {
            // For now, assume the date is already in UTC or local
            // and adjust to IST (UTC+5:30)
            const istOffset = 5.5 * 60 * 60 * 1000;
            return new Date(date.getTime() + istOffset);
        }
        return date;
    }

    /**
     * Handle truncated email recovery
     */
    static handleTruncatedEmail(
        subject: string,
        body: string,
        snippet?: string
    ): { subject: string; body: string; isTruncated: boolean } {
        const truncationIndicators = [
            /\[\.\.\.]/,
            /…$/,
            /\.\.\.$/,
            /\[message truncated]/i,
            /view\s+full\s+message/i,
        ];

        const isTruncated = truncationIndicators.some(p => p.test(body));

        if (isTruncated && snippet) {
            // Attempt to use snippet to fill in gaps
            // This is a best-effort approach
            const recoveredBody = body.replace(/\[\.\.\.]|…$|\.\.\.$/g, snippet);
            return { subject, body: recoveredBody, isTruncated: true };
        }

        return { subject, body, isTruncated };
    }
}
