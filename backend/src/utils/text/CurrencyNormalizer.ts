
export class CurrencyNormalizer {
    /**
     * Normalizes a currency string to a clean number.
     * Handles:
     * - Commas: "1,23,456" -> "123456"
     * - Symbols: "₹100", "Rs. 100", "INR 100", "Rs 100"
     * - Suffixes: "100/-"
     * - Whitespace: " 100 "
     * - OCR Artifacts: "Rs. 100.00." -> 100.00
     */
    static normalize(amountStr: string): number {
        if (!amountStr || typeof amountStr !== 'string') return NaN;

        let clean = amountStr.trim();

        // 1. Remove suffixes specifically (/-)
        clean = clean.replace(/\/-\s*$/, '');

        // 2. Remove common currency prefixes (case insensitive)
        // Handle "Rs.", "Rs", "INR", "₹"
        clean = clean.replace(/^(?:₹|INR|Rs\.?)\s*/i, '');
        // Also remove if at end
        clean = clean.replace(/\s*(?:₹|INR|Rs\.?)$/i, '');

        // 3. Remove commas (Indian or Western)
        clean = clean.replace(/,/g, '');

        // 4. Remove any remaining non-numeric chars logic
        // We want to keep: 0-9, decimal point, negative sign
        // But some OCR might return "100.." or "100. "
        clean = clean.replace(/[^0-9.-]/g, '');

        // 5. Fix double decimals if any (simple heuristic: keep first)
        const parts = clean.split('.');
        if (parts.length > 2) {
            clean = parts[0] + '.' + parts[1]; // Discard sub-decimals
        }

        const num = parseFloat(clean);
        return num;
    }

    /**
     * Extracts all potential amounts from a text blob, normalized.
     * Useful for finding all candidates.
     */
    static extractCandidates(text: string): number[] {
        // Broad regex to capture things looking like amounts
        // We look for numbers that might have commas, and optionally decimals
        // We accept 1 to 3 digits, then optional comma groups, then optional decimal
        const regex = /(?:₹|INR|Rs\.?|Amount)\s*[:\s]*((?:\d{1,3}(?:,\d{2,3})*|\d+)(?:\.\d{1,2})?)|\b((?:\d{1,3}(?:,\d{2,3})*|\d+)(?:\.\d{1,2})?)\s*(?:\/-|INR|Rs)/gi;

        const matches: number[] = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            const val = match[1] || match[2];
            if (val) {
                const num = this.normalize(val);
                if (!isNaN(num) && num > 0) matches.push(num);
            }
        }
        return matches;
    }
}
