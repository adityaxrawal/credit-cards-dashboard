
import { MERCHANT_RULES, MerchantRule } from '../../../data/merchants';
import { FuzzyMatcher } from '../../../utils/text/FuzzyMatcher';

export interface EnrichedMerchant {
    canonicalName: string;
    category: string;
    confidence: number;
    original: string;
    isMerchant: boolean;
}

export class MerchantEnricher {

    /**
     * Attempts to resolve a raw string to a known merchant.
     * @param raw - The raw merchant string (e.g. "Zomato Ltd via Razorpay")
     */
    static enrich(raw: string): EnrichedMerchant {
        const normalized = raw.toLowerCase().trim();

        // 1. Exact Match (Canonical OR Alias) - Highest Priority (1.0)
        for (const rule of MERCHANT_RULES) {
            if (rule.canonicalName.toLowerCase() === normalized) {
                return this.makeResult(raw, rule, 1.0);
            }
            if (rule.aliases.some(alias => alias.toLowerCase() === normalized)) {
                return this.makeResult(raw, rule, 1.0);
            }
        }

        // 2. Best Fuzzy/Substring Match
        let bestMatch: MerchantRule | null = null;
        let bestScore = 0;
        let bestMatchLength = 0;

        for (const rule of MERCHANT_RULES) {
            const candidates = [rule.canonicalName, ...rule.aliases, ...rule.fuzzyPatterns];

            for (const cand of candidates) {
                const candLower = cand.toLowerCase();
                let currentScore = 0;

                // A. Substring Match (Input contains Candidate)
                if (normalized.includes(candLower)) {
                    currentScore = 0.9;
                }
                // B. Fuzzy Ratio Match
                else {
                    const fuzzyScore = FuzzyMatcher.ratio(normalized, candLower);
                    if (fuzzyScore > 0.8) {
                        currentScore = fuzzyScore;
                    }
                }

                if (currentScore > 0) {
                    // Priority:
                    // 1. Higher Score wins significantly
                    // 2. Longer Match Length wins (Specificity)

                    if (currentScore > bestScore + 0.05) {
                        bestScore = currentScore;
                        bestMatch = rule;
                        bestMatchLength = candLower.length;
                    } else if (currentScore >= bestScore - 0.05 && candLower.length > bestMatchLength) {
                        bestScore = currentScore;
                        bestMatch = rule;
                        bestMatchLength = candLower.length;
                    }
                }
            }
        }

        if (bestMatch && bestScore >= 0.8) {
            return this.makeResult(raw, bestMatch, bestScore);
        }

        // 3. Fallback
        return {
            canonicalName: this.capitalize(raw),
            category: 'Uncategorized',
            confidence: 0,
            original: raw,
            isMerchant: true
        };
    }

    private static makeResult(raw: string, rule: MerchantRule, confidence: number): EnrichedMerchant {
        return {
            canonicalName: rule.canonicalName,
            category: rule.category,
            confidence: confidence,
            original: raw,
            isMerchant: true
        };
    }

    private static capitalize(s: string): string {
        if (!s) return '';
        return s.replace(/\b\w/g, c => c.toUpperCase());
    }
}
