
export class FuzzyMatcher {
    /**
     * Calculates Levenshtein distance between two strings
     */
    static distance(a: string, b: string): number {
        const m = a.length;
        const n = b.length;
        const dp: number[][] = [];

        for (let i = 0; i <= m; i++) {
            dp[i] = [i];
        }
        for (let j = 0; j <= n; j++) {
            dp[0][j] = j;
        }

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (a[i - 1] === b[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = Math.min(
                        dp[i - 1][j] + 1,     // deletion
                        dp[i][j - 1] + 1,     // insertion
                        dp[i - 1][j - 1] + 1  // substitution
                    );
                }
            }
        }

        return dp[m][n];
    }

    /**
     * Calculates similarity ratio (0 to 1)
     * 1.0 = exact match
     */
    static ratio(a: string, b: string): number {
        const dist = this.distance(a.toLowerCase(), b.toLowerCase());
        const maxLen = Math.max(a.length, b.length);
        if (maxLen === 0) return 1.0;
        return 1.0 - (dist / maxLen);
    }

    /**
    * Finds the best match from a list of candidates
    */
    static findBestMatch(query: string, candidates: string[], threshold: number = 0.8): { match: string, score: number } | null {
        let bestMatch = null;
        let bestScore = 0;

        const normalizedQuery = query.toLowerCase().trim();

        for (const candidate of candidates) {
            const score = this.ratio(normalizedQuery, candidate.toLowerCase());
            if (score > bestScore) {
                bestScore = score;
                bestMatch = candidate;
            }
        }

        if (bestScore >= threshold) {
            return { match: bestMatch!, score: bestScore };
        }

        return null;
    }
}
