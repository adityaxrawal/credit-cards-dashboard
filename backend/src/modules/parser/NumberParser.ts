
/**
 * NumberParser - Handles parsing of financial numbers including Indian localization
 */
export class NumberParser {

    /**
     * Parse amount string into number, handling various formats:
     * - Standard: "1,234.50" -> 1234.50
     * - Indian: "1,23,456.00" -> 123456.00
     * - Text (Lakh): "1.5 Lakh" -> 150000
     * - Text (Crore): "1.2 Cr" -> 12000000
     */
    static parseAmount(text: string): number | null {
        if (!text) return null;

        const cleanText = text.trim();

        // 1. Check for Lakh/Crore patterns first (highest precedence for mixed strings)
        // Matches: "1.5 Lakh", "50 Lakhs", "10.5 Cr", "5 Crore"
        const indianTextMatch = cleanText.match(/([\d,]+(?:\.\d+)?)\s*(Lakhs?|Crores?|Cr\.?|L\.?)\b/i);

        if (indianTextMatch) {
            const val = parseFloat(indianTextMatch[1].replace(/,/g, ''));
            const unit = indianTextMatch[2].toLowerCase().replace('.', '');

            if (unit.startsWith('l')) { // Lakh
                return val * 100000;
            } else if (unit.startsWith('c')) { // Crore
                return val * 10000000;
            }
        }

        // 2. Standard Currency Extraction using Regex
        // Matches: "₹ 1,234.50", "Rs. 1,234", "INR 12,345.00", "1234.50"
        // Regex looks for optional currency symbol followed by number
        const match = text.match(/[₹$€£]?\s*(?:Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)/i);

        if (match && match[1]) {
            // Remove commas and parse
            const numStr = match[1].replace(/,/g, '');
            const val = parseFloat(numStr);
            return isNaN(val) ? null : val;
        }

        return null;
    }

    /**
     * Format number to Indian Currency format (e.g. 1,23,456.00)
     */
    static formatToIndianCurrency(amount: number): string {
        return amount.toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2,
            style: 'currency',
            currency: 'INR'
        });
    }
}
