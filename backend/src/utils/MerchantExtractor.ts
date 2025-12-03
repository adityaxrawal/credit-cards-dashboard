export class MerchantExtractor {
    private static readonly INDICATORS = [
        "at", "from", "merchant", "to", "towards", "spent at", "txn at",
        "purchase at", "payment to", "paid to", "swiped at", "pos at",
        "transaction at", "transaction of rs.*?at"
    ];

    private static readonly STOP_WORDS = new Set([
        "on", "for", "dated", "date", "utr", "imps", "upi", "rs", "inr",
        "amount", "success", "failed", "card", "ending", "no", "ref",
        "reference", "time", "available", "approved", "transaction",
        "credit", "debit", "bank", "account", "balance", "limit", "info"
    ]);

    /**
     * Extract merchant name from text using heuristic keyword analysis and regex patterns
     */
    static extract(text: string): string | null {
        if (!text) return null;

        // Normalize text for scanning
        const lowerText = text.toLowerCase();

        // 1. Try Regex Patterns first (more specific)
        const regexPatterns = [
            /at\s+([a-z0-9\s&'\.\-]+?)\s+(?:on|dated|for|with)/i,
            /spent\s+(?:rs\.?|inr)\s*[\d,\.]+\s+at\s+([a-z0-9\s&'\.\-]+)/i,
            /transaction\s+of\s+(?:rs\.?|inr)\s*[\d,\.]+\s+at\s+([a-z0-9\s&'\.\-]+)/i,
            /paid\s+to\s+([a-z0-9\s&'\.\-]+?)\s+(?:on|for)/i,
            /purchase\s+at\s+([a-z0-9\s&'\.\-]+?)\s+(?:on|for)/i
        ];

        for (const pattern of regexPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const candidate = this.cleanMerchantName(match[1]);
                if (this.isValidMerchant(candidate)) {
                    return candidate;
                }
            }
        }

        // 2. Fallback to Keyword Scanning
        let bestMerchant: string | null = null;
        let bestMerchantScore = 0;

        for (const indicator of this.INDICATORS) {
            let startIndex = 0;
            while (true) {
                const idx = lowerText.indexOf(indicator, startIndex);
                if (idx === -1) break;

                // Check if indicator is a whole word or phrase start
                const charBefore = idx > 0 ? lowerText[idx - 1] : ' ';
                if (/[a-z0-9]/.test(charBefore)) {
                    startIndex = idx + 1;
                    continue;
                }

                // Extract candidate string after indicator
                const candidateStart = idx + indicator.length;
                // Take next 50 chars context
                const candidateText = text.substring(candidateStart, candidateStart + 50);

                const merchant = this.parseMerchantFromSubstring(candidateText);
                if (merchant && this.isValidMerchant(merchant)) {
                    // Heuristic: Prefer longer valid matches, but within reason
                    if (merchant.length > bestMerchantScore) {
                        bestMerchant = merchant;
                        bestMerchantScore = merchant.length;
                    }
                }

                startIndex = idx + 1;
            }
        }

        return bestMerchant;
    }

    private static parseMerchantFromSubstring(text: string): string | null {
        // Remove leading punctuation/spaces
        let cleaned = text.replace(/^[:\-\–\."\s]+/, '');

        // Tokenize by whitespace
        const tokens = cleaned.split(/\s+/);
        const merchantTokens: string[] = [];

        for (const token of tokens) {
            if (!token) continue;

            const lowerToken = token.toLowerCase().replace(/[^a-z0-9]/g, '');

            // Stop conditions
            if (this.STOP_WORDS.has(lowerToken)) break;
            if (/^\d/.test(token)) break; // Starts with number
            if (this.isMonth(token)) break;
            if (/[₹$€£]/.test(token)) break;
            if (token.toLowerCase().includes("xx")) break; // Masked numbers

            merchantTokens.push(token);
        }

        if (merchantTokens.length === 0) return null;

        // Join and trim
        return this.cleanMerchantName(merchantTokens.join(' '));
    }

    private static cleanMerchantName(name: string): string {
        return name
            .replace(/[\.,:;\-\–]+$/, '') // Remove trailing punctuation
            .replace(/\s+/g, ' ')         // Collapse spaces
            .trim();
    }

    private static isValidMerchant(name: string): boolean {
        if (!name || name.length < 2) return false;
        if (/^\d+$/.test(name)) return false; // All numbers
        if (this.STOP_WORDS.has(name.toLowerCase())) return false;
        return true;
    }

    private static isMonth(token: string): boolean {
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
            'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        return months.includes(token.toLowerCase().replace(/[^a-z]/g, ''));
    }
}
