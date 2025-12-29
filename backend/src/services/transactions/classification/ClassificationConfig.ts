/**
 * Classification Configuration
 * 
 * Centralized thresholds, tie-breaking rules, and per-bank overrides
 * for the transaction classification system.
 */

export interface ClassificationThresholds {
    /** Minimum confidence for rule-based classification */
    ruleMinConfidence: number;
    /** Minimum confidence for GPT classification */
    gptMinConfidence: number;
    /** Threshold for auto-acceptance without review */
    autoAcceptThreshold: number;
    /** Threshold below which needs manual review */
    needsReviewThreshold: number;
}

export interface BankOverride {
    domain: string;
    priorityBoost: number;
    specificPatterns?: string[];
    excludePatterns?: RegExp[];
}

export interface NegativePhrases {
    /** Phrases that should reduce classification confidence */
    patterns: RegExp[];
    /** Confidence penalty per match */
    penaltyPerMatch: number;
}

/**
 * Default classification configuration
 */
export const CLASSIFICATION_CONFIG = {
    thresholds: {
        ruleMinConfidence: 0.6,
        gptMinConfidence: 0.7,
        autoAcceptThreshold: 0.85,
        needsReviewThreshold: 0.5,
    } as ClassificationThresholds,

    /** Tie-breaking rules when multiple patterns match with equal weight */
    tieBreakers: {
        // Prefer more specific transaction types
        typeSpecificity: {
            'cc_spend': 1,
            'cc_upi': 2,
            'bank_upi_debit': 2,
            'bank_upi_credit': 2,
            'cc_payment': 3,
            'salary': 3,
            'investment': 3,
            'refund': 4,
            'bank_charge': 4,
            'interest_credit': 4,
            'interest_debit': 4,
            'unclassified': 0,
        } as Record<string, number>,

        // Prefer patterns that match in subject over body
        subjectVsBodyBoost: 0.15,

        // Prefer patterns with explicit amount mentions
        amountMentionBoost: 0.1,

        // Prefer sender domain matches
        domainMatchBoost: 0.2,
    },

    /** Per-domain/bank overrides */
    bankOverrides: [
        {
            domain: 'hdfcbank.com',
            priorityBoost: 0.05,
            specificPatterns: ['HDFC_SPECIFIC'],
        },
        {
            domain: 'icicibank.com',
            priorityBoost: 0.05,
        },
        {
            domain: 'sbi.co.in',
            priorityBoost: 0.05,
        },
        {
            domain: 'axisbank.com',
            priorityBoost: 0.05,
        },
        {
            domain: 'kotak.com',
            priorityBoost: 0.05,
        },
    ] as BankOverride[],

    /** Negative phrases that reduce classification confidence */
    negativePhrases: {
        patterns: [
            /unsubscribe/i,
            /privacy\s+policy/i,
            /terms\s+and\s+conditions/i,
            /marketing\s+communication/i,
            /promotional/i,
            /follow\s+us/i,
            /social\s+media/i,
            /refer\s+a\s+friend/i,
            /download\s+our\s+app/i,
            /rate\s+us/i,
            /feedback/i,
            /survey/i,
        ],
        penaltyPerMatch: 0.05,
    } as NegativePhrases,

    /** Hindi/Hinglish support patterns */
    multilingual: {
        hindi: {
            transaction: /लेन-देन|भुगतान|राशि|जमा|निकासी/,
            credit: /जमा|क्रेडिट|प्राप्त/,
            debit: /डेबिट|निकासी|भुगतान/,
        },
        hinglish: {
            transaction: /payment\s+ho\s+gaya|paisa\s+mila|amount\s+kata/i,
            credit: /mila|jama|receive/i,
            debit: /kata|gaya|paid/i,
        },
    },

    /** Loan/EMI exclusion patterns (classify but don't ingest) */
    excludeFromIngestion: [
        /emi\s+(?:due|payment|deducted|debited)/i,
        /loan\s+(?:disburs|repay|emi)/i,
        /(?:home|car|personal)\s+loan/i,
        /(?:instalment|installment)/i,
    ],

    /** Amount extraction preference order */
    amountPreference: [
        'subject',    // First check subject line
        'body_first', // Then first occurrence in body
        'body_max',   // Fallback to max amount in body
    ],
};

/**
 * Get bank-specific configuration
 */
export function getBankOverride(domain: string): BankOverride | undefined {
    return CLASSIFICATION_CONFIG.bankOverrides.find(
        b => domain.toLowerCase().includes(b.domain)
    );
}

/**
 * Calculate negative phrase penalty
 */
export function calculateNegativePenalty(text: string): number {
    const config = CLASSIFICATION_CONFIG.negativePhrases;
    let matches = 0;
    for (const pattern of config.patterns) {
        if (pattern.test(text)) {
            matches++;
        }
    }
    return Math.min(matches * config.penaltyPerMatch, 0.3); // Cap at 0.3
}

/**
 * Resolve tie between patterns with equal confidence
 */
export function resolveTie(
    type1: string,
    type2: string,
    context: {
        matchedInSubject1: boolean;
        matchedInSubject2: boolean;
        hasDomainMatch1: boolean;
        hasDomainMatch2: boolean;
    }
): string {
    const config = CLASSIFICATION_CONFIG.tieBreakers;

    let score1 = config.typeSpecificity[type1] || 0;
    let score2 = config.typeSpecificity[type2] || 0;

    if (context.matchedInSubject1) score1 += config.subjectVsBodyBoost;
    if (context.matchedInSubject2) score2 += config.subjectVsBodyBoost;

    if (context.hasDomainMatch1) score1 += config.domainMatchBoost;
    if (context.hasDomainMatch2) score2 += config.domainMatchBoost;

    return score1 >= score2 ? type1 : type2;
}

/**
 * Check if transaction type should be excluded from ingestion
 */
export function shouldExcludeFromIngestion(text: string): boolean {
    for (const pattern of CLASSIFICATION_CONFIG.excludeFromIngestion) {
        if (pattern.test(text)) {
            return true;
        }
    }
    return false;
}
