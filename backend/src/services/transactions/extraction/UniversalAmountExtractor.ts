import { CurrencyNormalizer } from '../../../utils/text/CurrencyNormalizer';

export class UniversalAmountExtractor {
    static extract(text: string): number {
        // Pre-cleaning: collapse spaces to single space to make regex simpler
        const cleanText = text.replace(/\s+/g, ' ');

        // Strategy Priority:
        // 1. Explicit Symbol Match (Highest Confidence): ₹ 500, INR 5,000.00
        // 2. Suffix Match: 500/-
        // 3. Contextual Match: "debited ... 500" (with distance constraint)
        // 4. Naked Float Fallback: "500.00" (Valid if resembles currency format)

        // 1. Explicit Currency Symbols
        // Supports: ₹ 1,23,456.78 | Rs. 500 | INR 500
        // Group 1: The Number
        const symbolRegex = /(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d+)?)/i;
        const symbolMatch = cleanText.match(symbolRegex);
        if (symbolMatch && symbolMatch[1]) {
            const val = CurrencyNormalizer.normalize(symbolMatch[1]);
            // Filter out things like "Rs. 2024" (Year) if context is bad? 
            // But usually explicit symbol is safe.
            if (!isNaN(val) && val > 0) return val;
        }

        // 2. Suffix Match (Indian specific)
        // Supports: 500/- or 1,500/-
        const suffixRegex = /([\d,]+(?:\.\d+)?)\s*\/-/;
        const suffixMatch = cleanText.match(suffixRegex);
        if (suffixMatch && suffixMatch[1]) {
            const val = CurrencyNormalizer.normalize(suffixMatch[1]);
            if (!isNaN(val) && val > 0) return val;
        }

        // 3. Strong Contextual Indicators
        // Look for keywords, allow up to ~20 chars of noise, then a number
        const keywords = 'amount|txn|transaction|payment|paid|spent|debited|credited|sent|received|withdrawal|refund|bill|due|recharge';
        const contextRegex = new RegExp(`(?:${keywords})\\D{1,20}?([\\d,]+(?:\\.\\d+)?)`, 'i');

        const contextMatch = cleanText.match(contextRegex);
        if (contextMatch && contextMatch[1]) {
            const val = CurrencyNormalizer.normalize(contextMatch[1]);
            // Avoid integers that look like years (2023, 2024) unless they have decimals
            // But if context is "debited", 2000 is likely amount.
            if (!isNaN(val) && val > 0) return val;
        }

        // 4. Naked Float (Strict Format)
        // Must look like currency: 1,234.50 or 123.50
        // Must have decimal part to be safe without symbol/context
        const floatRegex = /([\d,]+\.\d{2})/;
        const floatMatch = cleanText.match(floatRegex);
        if (floatMatch && floatMatch[1]) {
            const val = CurrencyNormalizer.normalize(floatMatch[1]);
            if (!isNaN(val) && val > 0) return val;
        }

        // 5. Naked Large Number (Integer) with Comma Separation
        // e.g. "1,00,000" -> Likely amount in financial email
        const commaIntRegex = /(\d{1,2},\d{2}(?:,\d{2,3})*)/; // Indian or Western commas required
        const commaMatch = cleanText.match(commaIntRegex);
        if (commaMatch && commaMatch[1]) {
            const val = CurrencyNormalizer.normalize(commaMatch[1]);
            if (!isNaN(val) && val > 0) return val;
        }

        throw new Error('Amount not found');
    }
}
