import { CurrencyNormalizer } from '../../../utils/text/CurrencyNormalizer';

export class UniversalAmountExtractor {
    static extract(text: string): number {
        // Strategy:
        // 1. Contextual Match (Confidence High): "spent Rs 500", "debited INR 1,200"
        // 2. Strict Pattern Match (Confidence Medium): "Rs. 1,500.00"
        // 3. Fallback Float Match (Confidence Low): "450.00" (Check constraints)

        // 1. Contextual Regex (Expanded keywords)
        const contextualRegex = /(?:spent|paid|debited|credited|txn|amount|transaction|payment|received|refund|withdrawal|sent|bill|due|recharge)\s+(?:of|for|is|was)?\s*(?::)?\s*(?:₹|INR|Rs\.?)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]+)?)/i;

        const contextMatch = text.match(contextualRegex);
        if (contextMatch && contextMatch[1]) {
            const val = CurrencyNormalizer.normalize(contextMatch[1]);
            if (!isNaN(val) && val > 0) return val;
        }

        // 2. Explicit Currency Symbol Regex
        // Matches: ₹123, INR 123, Rs. 123, Rs.123, 12,300.50
        // We look for the symbol strictly to be sure it's money.
        const symbolRegex = /(?:₹|INR|Rs\.?)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]+)?)/i;

        const symbolMatch = text.match(symbolRegex);
        if (symbolMatch && symbolMatch[1]) {
            const val = CurrencyNormalizer.normalize(symbolMatch[1]);
            if (!isNaN(val) && val > 0) return val;
        }

        // 3. Suffix Regex (e.g., 500/-)
        const suffixRegex = /([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]+)?)\s*\/-/;
        const suffixMatch = text.match(suffixRegex);
        if (suffixMatch && suffixMatch[1]) {
            const val = CurrencyNormalizer.normalize(suffixMatch[1]);
            if (!isNaN(val) && val > 0) return val;
        }


        // 4. Fallback: Identify floating point numbers that look like currency
        // Indian currency often has 2 decimal places: 123.45
        // Or specific comma formatting: 1,23,456
        const floatingMatch = text.match(/([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2}))/);
        if (floatingMatch && floatingMatch[1]) {
            const val = CurrencyNormalizer.normalize(floatingMatch[1]);
            // Additional constraint: Don't pick up small integers that look like dates/IDs unless they have .00
            if (!isNaN(val) && val > 0) return val;
        }

        throw new Error('Amount not found');
    }
}
