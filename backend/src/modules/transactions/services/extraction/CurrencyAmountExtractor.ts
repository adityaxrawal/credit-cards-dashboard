/**
 * Currency Amount Extractor
 * 
 * Extracts transaction amounts from text exactly as they appear,
 * detects currencies, and normalizes values while preserving originals.
 */

import {
    ALL_CURRENCIES,
    CurrencyDefinition,
    getCurrencyByCode,
    getCurrenciesBySymbol,
    ISO_CODE_PATTERN,
    isCryptoCurrency,
    DEFAULT_CURRENCY,
    SYMBOL_TO_CURRENCY,
} from '@shared/utils/currency/currencyDefinitions';

export interface ExtractedCurrencyAmount {
    rawAmountString: string;          // Exact string from email (unmodified)
    normalizedAmount: number;         // Parsed numeric value
    detectedCurrency: string | null;  // ISO code or null if unknown
    currencyConfidence: 'high' | 'medium' | 'low' | 'unknown';
    isNegative: boolean;
    isCrypto: boolean;
    detectionMethod: 'iso_code' | 'symbol' | 'context' | 'position' | 'default' | 'unknown';
    ambiguityFlags: string[];
}

interface CurrencyDetectionResult {
    currency: string | null;
    confidence: 'high' | 'medium' | 'low' | 'unknown';
    method: 'iso_code' | 'symbol' | 'context' | 'position' | 'default' | 'unknown';
    ambiguities: string[];
}

/**
 * Master regex patterns for amount extraction
 * Ordered by specificity (most specific first)
 */
const AMOUNT_PATTERNS: { pattern: RegExp; extractGroup: number; currencyGroup?: number }[] = [
    // Indian Text Format (Lakh/Crore): "1.5 Lakh", "10 Crores" - Highest Priority
    {
        pattern: /((?:₹|Rs\.?|INR)?\s*[\d,]+(?:\.\d+)?)\s*(Lakhs?|Crores?|Cr\.?|L\.?)\b/gi,
        extractGroup: 0,
    },
    // ISO code before amount: "USD 123.45", "EUR 1,234.56"
    {
        pattern: /\b([A-Z]{3})\s*([+-]?\d+(?:[,.']\d+)*)\b/gi,
        extractGroup: 2,
        currencyGroup: 1,
    },
    // Symbol before amount: "$123.45", "€1.234,56", "₹1,23,456.78", "Rs 1500"
    {
        pattern: /([₹$€£¥₿฿])\s*([+-]?\d+(?:[,.']\d+)*)/g,
        extractGroup: 2,
        currencyGroup: 1,
    },
    // S$, C$, A$, HK$ prefixed amounts
    {
        pattern: /([SACH]K?)\$\s*([+-]?\d+(?:[,.]\d+)*)/gi,
        extractGroup: 2,
        currencyGroup: 1,
    },
    // Rs, Rs. prefix: "Rs 500", "Rs. 1,234.56", "Rs 1500.00"
    {
        pattern: /Rs\.?\s*([+-]?\d+(?:[,.]\d+)*)/gi,
        extractGroup: 1,
    },
    // Amount with ISO suffix: "123.45 USD", "1,234.56 EUR"
    {
        pattern: /([+-]?\d+(?:[,.']\d+)*)\s*([A-Z]{3})\b/gi,
        extractGroup: 1,
        currencyGroup: 2,
    },
    // Amount with symbol suffix: "100 €", "1.234,56€"
    {
        pattern: /([+-]?\d+(?:[,.']\d+)*)\s*([₹$€£¥₿฿])/g,
        extractGroup: 1,
        currencyGroup: 2,
    },
    // Indian suffix notation: "500/-", "1,234.56/-"
    {
        pattern: /([+-]?\d+(?:[,.]\d+)*)\s*\/-/g,
        extractGroup: 1,
    },
    // Bracketed negative: "(123.45)"
    {
        pattern: /\((\d+(?:[,.]\d+)*)\)/g,
        extractGroup: 1,
    },
    // Generic with keyword context: "Amount: 500.00"
    // Keep generic slightly stricter to avoid capturing dates/phones?
    // Actually \d+(?:[,.]\d+)* reflects "digits followed by optional fractions". 
    // "2024" matches. "500.00" matches.
    {
        pattern: /(?:amount|total|balance|payment|paid|spent|debited|credited|received|purchase)[:\s]+([+-]?\d+(?:[,.]\d+)*)/gi,
        extractGroup: 1,
    },
];

/**
 * Contextual keywords that indicate credit/negative values
 */
const CREDIT_INDICATORS = /\b(credit|credited|cr|refund|refunded|reversal|cashback)\b/i;
const DEBIT_INDICATORS = /\b(debit|debited|dr|spent|paid|payment|charged|used|purchase)\b/i;

/**
 * Currency Amount Extractor Class
 */
export class CurrencyAmountExtractor {
    /**
     * Extract the primary amount from text
     * Returns the first valid amount found with currency detection
     */
    static extract(text: string): ExtractedCurrencyAmount {
        const results = this.extractAll(text);

        if (results.length === 0) {
            throw new Error('No valid amount found in text');
        }

        // Return the first (most confident) result
        return results[0];
    }

    /**
     * Extract all amounts from text
     * Returns array sorted by confidence (high to low)
     */
    static extractAll(text: string): ExtractedCurrencyAmount[] {
        const results: ExtractedCurrencyAmount[] = [];
        const seenAmounts = new Set<string>();

        for (const { pattern, extractGroup, currencyGroup } of AMOUNT_PATTERNS) {
            // Reset regex lastIndex
            pattern.lastIndex = 0;

            let match: RegExpExecArray | null;
            while ((match = pattern.exec(text)) !== null) {
                const rawAmount = match[extractGroup];
                if (!rawAmount || seenAmounts.has(rawAmount)) continue;

                seenAmounts.add(rawAmount);

                // Get raw currency indicator if present
                let rawCurrency: string | undefined;
                if (currencyGroup !== undefined) {
                    rawCurrency = match[currencyGroup];
                }

                // Detect currency
                const detection = this.detectCurrency(rawCurrency, text, match[0]);

                // Check for negative indicators
                const isNegative = this.isNegativeAmount(match[0], text);

                // Normalize the amount
                const normalized = this.normalizeAmount(rawAmount, detection.currency);

                if (isNaN(normalized) || normalized <= 0) continue;

                results.push({
                    rawAmountString: match[0].trim(),
                    normalizedAmount: isNegative ? -Math.abs(normalized) : normalized,
                    detectedCurrency: detection.currency,
                    currencyConfidence: detection.confidence,
                    isNegative,
                    isCrypto: detection.currency ? isCryptoCurrency(detection.currency) : false,
                    detectionMethod: detection.method,
                    ambiguityFlags: detection.ambiguities,
                });
            }
        }

        // Sort by confidence: high > medium > low > unknown
        const confidenceOrder = { high: 0, medium: 1, low: 2, unknown: 3 };
        results.sort((a, b) =>
            confidenceOrder[a.currencyConfidence] - confidenceOrder[b.currencyConfidence]
        );

        // DEBUG LOG
        // console.log('Extracted Results:', JSON.stringify(results, null, 2));

        return results;
    }

    /**
     * Detect currency from raw indicator and context
     */
    private static detectCurrency(
        rawIndicator: string | undefined,
        fullText: string,
        matchContext: string
    ): CurrencyDetectionResult {
        const ambiguities: string[] = [];

        // Priority 1: ISO code in the match
        if (rawIndicator) {
            const upper = rawIndicator.toUpperCase();

            // Check if it's a valid ISO code
            if (ISO_CODE_PATTERN.test(upper)) {
                const currency = getCurrencyByCode(upper);
                if (currency) {
                    return {
                        currency: currency.code,
                        confidence: 'high',
                        method: 'iso_code',
                        ambiguities: [],
                    };
                }
            }

            // Check if it's a symbol
            const possibleCurrencies = getCurrenciesBySymbol(rawIndicator);
            if (possibleCurrencies.length === 1) {
                return {
                    currency: possibleCurrencies[0].code,
                    confidence: 'high',
                    method: 'symbol',
                    ambiguities: [],
                };
            } else if (possibleCurrencies.length > 1) {
                // Ambiguous symbol - try to disambiguate from context
                ambiguities.push(`Ambiguous symbol: ${rawIndicator} could be ${possibleCurrencies.map(c => c.code).join(', ')}`);

                // Check for ISO code nearby in text
                const isoMatch = fullText.match(ISO_CODE_PATTERN);
                if (isoMatch) {
                    const matchedCode = isoMatch[1].toUpperCase();
                    const matching = possibleCurrencies.find(c => c.code === matchedCode);
                    if (matching) {
                        return {
                            currency: matching.code,
                            confidence: 'medium',
                            method: 'context',
                            ambiguities,
                        };
                    }
                }

                // Default disambiguation for common cases
                if (rawIndicator === '$') {
                    // Check for explicit regional codes
                    if (/\b(S\$|SGD)\b/i.test(fullText)) {
                        return { currency: 'SGD', confidence: 'medium', method: 'context', ambiguities };
                    }
                    if (/\b(C\$|CAD)\b/i.test(fullText)) {
                        return { currency: 'CAD', confidence: 'medium', method: 'context', ambiguities };
                    }
                    if (/\b(A\$|AUD)\b/i.test(fullText)) {
                        return { currency: 'AUD', confidence: 'medium', method: 'context', ambiguities };
                    }
                    if (/\b(HK\$|HKD)\b/i.test(fullText)) {
                        return { currency: 'HKD', confidence: 'medium', method: 'context', ambiguities };
                    }
                    // Default to USD for bare $
                    return { currency: 'USD', confidence: 'low', method: 'symbol', ambiguities };
                }

                if (rawIndicator === '¥') {
                    if (/\b(JPY|Japan|Yen)\b/i.test(fullText)) {
                        return { currency: 'JPY', confidence: 'medium', method: 'context', ambiguities };
                    }
                    if (/\b(CNY|China|Yuan|RMB)\b/i.test(fullText)) {
                        return { currency: 'CNY', confidence: 'medium', method: 'context', ambiguities };
                    }
                    // Default to JPY
                    return { currency: 'JPY', confidence: 'low', method: 'symbol', ambiguities };
                }

                // Return first option with low confidence
                return {
                    currency: possibleCurrencies[0].code,
                    confidence: 'low',
                    method: 'symbol',
                    ambiguities,
                };
            }

            // Handle prefix-based symbols like S$, C$, etc.
            if (/^[SACH]K?$/i.test(rawIndicator)) {
                const prefixMap: Record<string, string> = {
                    'S': 'SGD',
                    'C': 'CAD',
                    'A': 'AUD',
                    'HK': 'HKD',
                };
                const code = prefixMap[rawIndicator.toUpperCase()];
                if (code) {
                    return { currency: code, confidence: 'high', method: 'symbol', ambiguities: [] };
                }
            }
        }

        // Priority 2: Look for ISO code elsewhere in text
        const globalIsoMatch = fullText.match(ISO_CODE_PATTERN);
        if (globalIsoMatch) {
            const code = globalIsoMatch[1].toUpperCase();
            return {
                currency: code,
                confidence: 'medium',
                method: 'context',
                ambiguities: ['Currency inferred from text context, not directly attached to amount'],
            };
        }

        // Priority 3: Check for Rs. or ₹ nearby (Indian Rupee indicators)
        if (/(?:Rs\.?|₹)/i.test(matchContext) || /(?:Rs\.?|₹)\s*$/i.test(matchContext)) {
            return { currency: 'INR', confidence: 'high', method: 'symbol', ambiguities: [] };
        }

        // Priority 3.5: Indian Text Suffixes (Lakhs/Crores)
        if (/(?:Lakhs?|Crores?|Cr\.?|L\.?)\b/i.test(matchContext)) {
            return { currency: 'INR', confidence: 'high', method: 'context', ambiguities: [] };
        }

        // Priority 4: Check for suffix notation like "/-" (Indian)
        if (/\/-/.test(matchContext)) {
            return {
                currency: 'INR',
                confidence: 'medium',
                method: 'position',
                ambiguities: ['Currency inferred from /- suffix (commonly Indian)'],
            };
        }

        // Cannot detect currency
        return {
            currency: null,
            confidence: 'unknown',
            method: 'unknown',
            ambiguities: ['Unable to detect currency - no symbol or code found'],
        };
    }

    /**
     * Check if amount is negative based on context
     */
    private static isNegativeAmount(match: string, fullText: string): boolean {
        // Check for explicit negative sign
        if (match.startsWith('-') || match.startsWith('−')) {
            return true;
        }

        // Check for bracketed format (accounting negative)
        if (/^\([\d,.]+\)$/.test(match)) {
            return true;
        }

        // Check nearby context for credit indicators
        const contextWindow = fullText.substring(
            Math.max(0, fullText.indexOf(match) - 50),
            Math.min(fullText.length, fullText.indexOf(match) + match.length + 50)
        );

        // Remove the matched amount string from contextWindow to avoid self-match 
        // (e.g. "1.5 Cr" - Cr is unit, not credit indicator)
        const contextWithoutMatch = contextWindow.replace(match, '___');

        // Refund/credit usually means money coming back (positive in credit direction)
        // But for expense tracking, it's often shown as negative
        // This depends on business logic - for now, mark credits as negative
        if (CREDIT_INDICATORS.test(contextWithoutMatch) && !DEBIT_INDICATORS.test(contextWithoutMatch)) {
            return true;
        }

        return false;
    }

    /**
     * Normalize amount string to number
     * Handles different decimal/thousand separator conventions
     */
    private static normalizeAmount(raw: string, currencyCode: string | null): number {
        let clean = raw.trim();
        let multiplier = 1;

        // Check for Indian Suffixes first (before they get stripped)
        const indianMatch = clean.match(/([\d,]+(?:\.\d+)?)\s*(Lakhs?|Crores?|Cr\.?|L\.?)\b/i);
        if (indianMatch) {
            const unit = indianMatch[2].toLowerCase().replace('.', '');
            if (unit.startsWith('l')) multiplier = 100000;
            else if (unit.startsWith('c')) multiplier = 10000000;

            // Remove the suffix so we can parse the number part cleanly
            clean = clean.replace(indianMatch[0], indianMatch[1]);
        }

        // Remove currency symbols and whitespace
        clean = clean.replace(/[₹$€£¥₿฿Ξ₮]/g, '');
        clean = clean.replace(/Rs\.?\s*/gi, '');
        clean = clean.replace(/\/-\s*$/, '');
        clean = clean.replace(/[A-Z]{3}\s*/gi, '');
        clean = clean.replace(/\s+/g, '');

        if (clean.includes("'")) clean = clean.replace(/'/g, '');

        let val = 0;
        const commaCount = (clean.match(/,/g) || []).length;
        const periodCount = (clean.match(/\./g) || []).length;

        if (commaCount === 0 && periodCount === 0) val = parseInt(clean, 10);
        else if (commaCount === 0 && periodCount === 1) val = parseFloat(clean);
        else if (commaCount === 1 && periodCount === 0) {
            const parts = clean.split(',');
            const lastPart = parts[parts.length - 1];
            if (lastPart.length <= 2) val = parseFloat(clean.replace(',', '.'));
            else val = parseFloat(clean.replace(',', ''));
        }
        else if (commaCount > 1 && periodCount === 0) val = parseFloat(clean.replace(/,/g, ''));
        else if (periodCount > 1 && commaCount === 0) val = parseFloat(clean.replace(/\./g, ''));
        else if (commaCount >= 1 && periodCount === 1) {
            const lastCommaIndex = clean.lastIndexOf(',');
            const lastPeriodIndex = clean.lastIndexOf('.');
            if (lastCommaIndex > lastPeriodIndex) clean = clean.replace(/\./g, '').replace(',', '.');
            else clean = clean.replace(/,/g, '');
            val = parseFloat(clean);
        }
        else if (commaCount === 1 && periodCount >= 1) {
            clean = clean.replace(/,/g, '').replace(/\./g, '');
            val = parseFloat(clean);
        }
        else {
            const normalized = clean.replace(/[^\d.,]/g, '');
            const lastSep = Math.max(normalized.lastIndexOf(','), normalized.lastIndexOf('.'));
            if (lastSep > 0) {
                const beforeSep = normalized.substring(0, lastSep).replace(/[.,]/g, '');
                const afterSep = normalized.substring(lastSep + 1);
                val = parseFloat(`${beforeSep}.${afterSep}`);
            } else {
                val = parseFloat(normalized.replace(/[.,]/g, ''));
            }
        }

        return val * multiplier;
    }

    /**
     * Quick check if text likely contains an amount
     */
    static hasAmount(text: string): boolean {
        // Quick check for common patterns
        return /[\d]+[.,]?\d*/.test(text) &&
            (
                /[₹$€£¥₿฿]/.test(text) ||
                /\b[A-Z]{3}\b/.test(text) ||
                /Rs\.?/i.test(text) ||
                /\/-/.test(text) ||
                /\bamount\b/i.test(text)
            );
    }
}
