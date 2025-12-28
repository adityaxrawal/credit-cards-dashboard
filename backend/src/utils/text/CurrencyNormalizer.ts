
export class CurrencyNormalizer {
    /**
     * Normalizes a currency string to a clean number.
     * Handles:
     * - Commas: "1,23,456" -> "123456"
     * - Symbols: "₹100", "Rs. 100", "INR 100"
     * - Suffixes: "100/-"
     * - Whitespace: " 100 "
     * - Trailing/Leading text junk that might be caught in loose regex
     */
    static normalize(amountStr: string): number {
        if (!amountStr) return NaN;

        let clean = amountStr.toString().trim();

        // Remove commonly used currency symbols and codes (case insensitive)
        clean = clean.replace(/(?:₹|INR|Rs\.?)\s?/gi, '');

        // Remove suffixes like "/-" often used in Indian formatting
        clean = clean.replace(/\/-\s*$/, '');

        // Remove commas
        clean = clean.replace(/,/g, '');

        // Remove any other non-numeric characters except the decimal point
        // NOTE: We must be careful not to remove the decimal point or negative sign
        // But usually negative sign is handled by direction, not amount value here.
        // Let's assume absolute amount for now, or handle negative.
        clean = clean.replace(/[^0-9.-]/g, '');

        // Parse
        const num = parseFloat(clean);
        return num;
    }

    /**
     * Extracts all potential amounts from a text blob, normalized.
     * Useful for finding all candidates.
     */
    static extractCandidates(text: string): number[] {
        // Broad regex to capture things looking like amounts
        // \d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?
        // Plus handling symbols
        const regex = /(?:₹|INR|Rs\.?|Amount)\s*[:\s]*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?)|(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?)\s*(?:\/-|INR)/gi;

        const matches: number[] = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            // match[1] or match[2]
            const val = match[1] || match[2];
            if (val) {
                const num = this.normalize(val);
                if (!isNaN(num)) matches.push(num);
            }
        }
        return matches;
    }
}
