export class MerchantNormalizer {
    // Common merchants mapping (could be moved to DB or config)
    private static knownMerchants = new Map<string, string>([
        ['swiggy', 'Swiggy'],
        ['zomato', 'Zomato'],
        ['uber', 'Uber'],
        ['ola', 'Ola'],
        ['amazon', 'Amazon'],
        ['flipkart', 'Flipkart'],
        ['netflix', 'Netflix'],
        ['spotify', 'Spotify'],
        ['apple', 'Apple'],
        ['google', 'Google'],
        ['microsoft', 'Microsoft'],
        ['starbucks', 'Starbucks'],
        ['mcdonalds', "McDonald's"],
        ['dominos', "Domino's"],
        ['pizzahut', 'Pizza Hut'],
        ['kfc', 'KFC'],
        ['subway', 'Subway'],
        ['jiomart', 'JioMart'],
        ['bigbasket', 'BigBasket'],
        ['blinkit', 'Blinkit'],
        ['zepto', 'Zepto'],
        ['paytm', 'Paytm'],
        ['phonepe', 'PhonePe'],
        ['razorpay', 'Razorpay'],
        ['cred', 'CRED'],
        ['airtel', 'Airtel'],
        ['jio', 'Jio'],
        ['vi', 'Vi'],
        ['bookmyshow', 'BookMyShow'],
    ]);

    static normalize(rawMerchant: string | null | undefined): string | null {
        if (!rawMerchant) return null;

        // 1. Clean up
        let clean = rawMerchant
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^a-z0-9\s]/g, '') // remove special chars
            .trim();

        // 2. Remove common suffixes
        clean = clean.replace(/\s+(india|private|limited|pvt|ltd|inc|corp|bangalore|mumbai|delhi)$/g, '').trim();

        if (!clean) return rawMerchant; // Return original if cleaning removed everything

        // 3. Check exact match
        if (this.knownMerchants.has(clean)) {
            return this.knownMerchants.get(clean)!;
        }

        // 4. Fuzzy match (Levenshtein distance)
        // Simple implementation for < 50 items
        let bestMatch: string | null = null;
        let minDistance = Infinity;

        for (const known of this.knownMerchants.keys()) {
            const distance = this.levenshteinDistance(clean, known);
            if (distance <= 2 && distance < minDistance) { // Tolerance of 2 edits
                minDistance = distance;
                bestMatch = known;
            }
        }

        if (bestMatch) {
            return this.knownMerchants.get(bestMatch)!;
        }

        // 5. Default formatting: Capitalize words
        return clean.replace(/\b\w/g, l => l.toUpperCase());
    }

    private static levenshteinDistance(a: string, b: string): number {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        Math.min(
                            matrix[i][j - 1] + 1, // insertion
                            matrix[i - 1][j] + 1  // deletion
                        )
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }
}
