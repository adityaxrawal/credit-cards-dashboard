
/**
 * Transaction Prefilter (Signal-Based)
 * 
 * A flexible, bank-agnostic scoring system to pre-screen emails before ML processing.
 * 
 * Design Philosophy:
 * - High Recall: We accept almost anything that LOOKS like a transaction.
 * - Score-Based: Signals are weighted. Passing threshold triggers ML.
 * - Global: No bank-specific hardcoded strings (like "HDFC").
 * 
 * Future Config:
 * - Weights can be loaded from DB/Env/Remote Config.
 */

export interface EvaluationResult {
    shouldProcess: boolean;
    score: number;
    triggeredSignals: string[];
}

export interface Signal {
    name: string;
    weight: number;
    test: (text: string) => boolean;
}

export class TransactionPrefilter {

    // Default Threshold: Low enough to catch weak signals, high enough to filter pure noise.
    private static DEFAULT_THRESHOLD = 15;

    private static signals: Signal[] = [
        {
            name: 'CURRENCY_SYMBOL',
            weight: 20,
            test: (text) => /[₹$€£¥]/.test(text)
        },
        {
            name: 'CURRENCY_CODE',
            weight: 20,
            test: (text) => /\b(?:INR|USD|EUR|GBP|AUD|CAD|SGD|AED)\b/i.test(text)
        },
        {
            name: 'MASKED_CARD_OR_ACCOUNT',
            weight: 30, // Very strong signal
            // Matches: xx1234, XX1234, ...1234 (3+ dots), asterisk masked
            test: (text) => /(?:x{2,}|\*{4,}|\.{3,})\d{4}\b/i.test(text) || /\bjd\s?\d{4}\b/i.test(text) // 'jd' captures some legacy formats, mostly standardizing on masked
        },
        {
            name: 'TRANSACTION_VERB',
            weight: 15,
            test: (text) => /\b(?:spent|debited|credited|paid|purchase|charged|withdrawn|transferred|declined|payment|txn|transaction)\b/i.test(text)
        },
        {
            name: 'AMOUNT_PATTERN',
            weight: 10,
            // Matches numbers with decimals (1,000.00) OR just commas (1,000)
            test: (text) => /\b\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\b|\b\d+\.\d{1,2}\b/.test(text)
        },
        {
            name: 'BANKING_TERMS',
            weight: 10,
            test: (text) => /\b(?:acct|account|limit|balance|stmt|statement|bill|due date|total due|min due)\b/i.test(text)
        },
        {
            name: 'DIGITAL_WALLET',
            weight: 15,
            test: (text) => /\b(?:upi|vpa|wallet|merchant|qr code)\b/i.test(text)
        },
        {
            name: 'OTP_ALERT',
            weight: 25, // Strong signal for transaction verification emails
            test: (text) => /\b(?:otp|one time password|verification code|auth code)\b/i.test(text)
        }
    ];

    /**
     * Evaluate text against signals
     */
    static evaluate(text: string, thresholdOverride?: number): EvaluationResult {
        if (!text || text.length < 10) {
            return { shouldProcess: false, score: 0, triggeredSignals: [] };
        }

        const threshold = thresholdOverride ?? (
            process.env.PREFILTER_THRESHOLD ? parseInt(process.env.PREFILTER_THRESHOLD) : this.DEFAULT_THRESHOLD
        );

        let score = 0;
        const triggeredSignals: string[] = [];

        // Normalize text once for performance (optional, but good for case-insensitive regex longevity)
        // Regexes are already 'i' flag so raw text is fine mostly.

        for (const signal of this.signals) {
            if (signal.test(text)) {
                score += signal.weight;
                triggeredSignals.push(signal.name);
            }
        }

        return {
            shouldProcess: score >= threshold,
            score,
            triggeredSignals
        };
    }

    /**
     * Helper to inspect signals (for debug/admin)
     */
    static getSignals() {
        return this.signals.map(s => ({ name: s.name, weight: s.weight }));
    }
}
