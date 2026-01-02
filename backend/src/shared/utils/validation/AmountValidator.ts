import logger from '../infrastructure/logger';

/**
 * Amount validation result
 */
export interface AmountValidationResult {
    isValid: boolean;
    normalizedAmount: number;
    confidence: number;
    flags: string[];
    currency: string;
}

/**
 * Configuration for amount validation
 */
interface ValidationConfig {
    minAmount?: number;      // Minimum valid amount (default: 0.01)
    maxAmount?: number;      // Maximum valid amount (default: 10,000,000)
    warnLargeAmount?: number; // Threshold for large amount warning
    userCardLimit?: number;  // Optional: user's card limit for context
    monthlySpend?: number;   // Optional: user's typical monthly spend
}

/**
 * AmountValidator - Validate and normalize extracted amounts
 */
export class AmountValidator {
    private static readonly DEFAULT_MIN = 0.01;  // 1 paisa
    private static readonly DEFAULT_MAX = 10000000; // 1 crore
    private static readonly LARGE_AMOUNT_THRESHOLD = 100000; // 1 lakh

    /**
     * Validate an extracted amount
     */
    static validate(
        amount: number | string,
        config?: ValidationConfig
    ): AmountValidationResult {
        const flags: string[] = [];
        let confidence = 1.0;
        let currency = 'INR';

        // Parse amount if string
        const parsedAmount = this.parseAmount(amount);

        if (parsedAmount === null || isNaN(parsedAmount)) {
            return {
                isValid: false,
                normalizedAmount: 0,
                confidence: 0,
                flags: ['PARSE_ERROR'],
                currency
            };
        }

        // Normalize to 2 decimal places
        const normalizedAmount = Math.round(parsedAmount * 100) / 100;

        // Range validation
        const minAmount = config?.minAmount ?? this.DEFAULT_MIN;
        const maxAmount = config?.maxAmount ?? this.DEFAULT_MAX;

        if (normalizedAmount < minAmount) {
            return {
                isValid: false,
                normalizedAmount,
                confidence: 0,
                flags: ['BELOW_MINIMUM'],
                currency
            };
        }

        if (normalizedAmount > maxAmount) {
            return {
                isValid: false,
                normalizedAmount,
                confidence: 0,
                flags: ['EXCEEDS_MAXIMUM'],
                currency
            };
        }

        // Large amount warning
        const largeThreshold = config?.warnLargeAmount ?? this.LARGE_AMOUNT_THRESHOLD;
        if (normalizedAmount > largeThreshold) {
            flags.push('LARGE_AMOUNT');
            confidence -= 0.1;
        }

        // Pattern anomaly checks
        if (normalizedAmount > 100000 && normalizedAmount % 1000 === 0) {
            flags.push('SUSPICIOUSLY_ROUND');
            confidence -= 0.05;
        }

        // Check against user's card limit if provided
        if (config?.userCardLimit && normalizedAmount > config.userCardLimit) {
            flags.push('EXCEEDS_CARD_LIMIT');
            confidence -= 0.2;
        }

        // Check against monthly spending pattern if provided
        if (config?.monthlySpend && normalizedAmount > config.monthlySpend * 1.5) {
            flags.push('EXCEEDS_PATTERN');
            confidence -= 0.15;
        }

        // Common amounts get a small bonus
        const commonAmounts = [50, 99, 100, 149, 199, 200, 249, 299, 399, 499, 500, 599, 699, 799, 999, 1000, 1499, 1999, 2000, 2999, 4999, 5000, 9999, 10000];
        if (commonAmounts.includes(Math.floor(normalizedAmount))) {
            confidence = Math.min(confidence + 0.05, 1.0);
        }

        // Very small amounts (< 10) are suspicious unless exact
        if (normalizedAmount < 10 && normalizedAmount !== Math.floor(normalizedAmount)) {
            flags.push('UNUSUAL_SMALL_DECIMAL');
            confidence -= 0.1;
        }

        return {
            isValid: confidence > 0.3,
            normalizedAmount,
            confidence: Math.max(0, Math.min(1, confidence)),
            flags,
            currency
        };
    }

    /**
     * Parse amount from various formats
     */
    private static parseAmount(amount: number | string): number | null {
        if (typeof amount === 'number') {
            return amount;
        }

        if (typeof amount !== 'string') {
            return null;
        }

        // Remove currency symbols and common prefixes
        let cleaned = amount
            .replace(/[₹$€£¥]/g, '')
            .replace(/^(rs\.?|inr|usd|eur)\s*/i, '')
            .replace(/,/g, '') // Remove thousand separators
            .replace(/\s+/g, '')
            .trim();

        // Handle lakh/crore notation
        const lakhMatch = cleaned.match(/^([\d.]+)\s*(?:lakh|lac|l)/i);
        if (lakhMatch) {
            return parseFloat(lakhMatch[1]) * 100000;
        }

        const croreMatch = cleaned.match(/^([\d.]+)\s*(?:crore|cr)/i);
        if (croreMatch) {
            return parseFloat(croreMatch[1]) * 10000000;
        }

        // Handle K notation (5K = 5000)
        const kMatch = cleaned.match(/^([\d.]+)\s*k$/i);
        if (kMatch) {
            return parseFloat(kMatch[1]) * 1000;
        }

        // Parse as float
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? null : parsed;
    }

    /**
     * Extract amount from text with currency detection
     */
    static extractFromText(text: string): { amount: number; currency: string; confidence: number } | null {
        // Pattern 1: ₹ or Rs. followed by number
        const inrPatterns = [
            /[₹]\s*([\d,]+\.?\d*)/,
            /rs\.?\s*([\d,]+\.?\d*)/i,
            /inr\s*([\d,]+\.?\d*)/i,
            /([\d,]+\.?\d*)\s*(?:rupees?|₹)/i,
        ];

        for (const pattern of inrPatterns) {
            const match = text.match(pattern);
            if (match) {
                const amount = this.parseAmount(match[1]);
                if (amount !== null && amount > 0) {
                    return { amount, currency: 'INR', confidence: 0.9 };
                }
            }
        }

        // Pattern 2: USD/EUR
        const usdPattern = /\$\s*([\d,]+\.?\d*)/;
        const usdMatch = text.match(usdPattern);
        if (usdMatch) {
            const amount = this.parseAmount(usdMatch[1]);
            if (amount !== null && amount > 0) {
                return { amount, currency: 'USD', confidence: 0.85 };
            }
        }

        // Pattern 3: Generic number after amount keywords
        const amountKeywordPattern = /(?:amount|total|paid|spent|debited|credited|received|charged)\s*(?:of|:)?\s*[₹Rs.]*\s*([\d,]+\.?\d*)/i;
        const keywordMatch = text.match(amountKeywordPattern);
        if (keywordMatch) {
            const amount = this.parseAmount(keywordMatch[1]);
            if (amount !== null && amount > 0) {
                return { amount, currency: 'INR', confidence: 0.75 };
            }
        }

        return null;
    }

    /**
     * Compare two amounts for equality with tolerance
     */
    static areEqual(amount1: number, amount2: number, tolerancePercent: number = 0.01): boolean {
        if (amount1 === amount2) return true;

        const diff = Math.abs(amount1 - amount2);
        const avg = (amount1 + amount2) / 2;

        return (diff / avg) <= tolerancePercent;
    }
}
