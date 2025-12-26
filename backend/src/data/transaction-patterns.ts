/**
 * Transaction Patterns for Enhanced Rule-Based Classification
 * 
 * Each pattern group has:
 * - priority: 1-10 (higher wins in conflicts)
 * - keywords: array of { pattern: RegExp, weight: 0-1 }
 * - excludePatterns: optional array of RegExp to reject false positives
 * - isTransaction: whether this pattern indicates an actual transaction
 */

export interface PatternKeyword {
    pattern: RegExp;
    weight: number;
}

export interface PatternGroup {
    priority: number;
    keywords: PatternKeyword[];
    excludePatterns?: RegExp[];
    isTransaction: boolean;
    transactionType?: string;
    direction?: 'debit' | 'credit';
}

export const TRANSACTION_PATTERNS: Record<string, PatternGroup> = {
    // ============================================
    // HIGH PRIORITY TRANSACTION PATTERNS (8-10)
    // ============================================

    // ============================================
    // CRITICAL PRIORITY (11+)
    // ============================================

    BILL_REMINDER: {
        priority: 11,
        isTransaction: false,
        keywords: [
            { pattern: /(?:bill|payment|amount)\s+(?:due|overdue|outstanding)/i, weight: 1.0 },
            { pattern: /total\s+(?:amount)?\s+due.*[₹Rs.INR]*/i, weight: 0.95 },
            { pattern: /statement\s+(?:generated|available)/i, weight: 0.95 },
            { pattern: /pay\s+by\s+(?:date|time)/i, weight: 0.9 },
        ],
        excludePatterns: [
            /(?:payment|txn|transaction)\s+(?:successful|confirmed|received|processed)/i,
            /thank\s+you\s+for\s+(?:making|your)\s+payment/i
        ]
    },

    OTP_EXCLUSION: {
        priority: 100, // Highest priority
        isTransaction: false,
        transactionType: 'non_financial',
        keywords: [
            { pattern: /otp\s+is\s+|verification\s+code|one\s+time\s+password/i, weight: 1.0 },
            { pattern: /authori[zs]e\s+payment|authenticate\s+transaction/i, weight: 0.95 },
            { pattern: /do\s+not\s+share\s+this\s+code/i, weight: 0.9 },
            { pattern: /login\s+alert|new\s+device\s+detected/i, weight: 0.9 }
        ]
    },

    PAYMENT_CONFIRMATION: {
        priority: 10,
        isTransaction: true,
        transactionType: 'cc_spend',
        direction: 'debit',
        keywords: [
            // Strict: "Transaction of Rs 500" - Must have currency or be very clear
            { pattern: /your\s+(?:payment|transaction)\s+(?:of|for)?\s*[₹Rs.INR]+[\s.]*[\d,]+(?:\.\d{2})?/i, weight: 1.0 },
            // Strict: Lookahead to ensure it's not a request
            { pattern: /(?:payment|txn|transaction)\s+(?:was\s+)?(?:successful|approved|processed)(?!.*otp)/i, weight: 0.95 },
            { pattern: /amount\s+[₹Rs.INR]*\s*[\d,]+\.?\d*\s+(?:debited|charged|deducted)/i, weight: 0.95 },
            { pattern: /spent\s+[₹Rs.INR]*\s*[\d,]+/i, weight: 0.9 },
            { pattern: /purchase\s+(?:of|for)?\s*[₹Rs.INR]*\s*[\d,]+/i, weight: 0.9 },
            { pattern: /order\s+(?:placed|confirmed|successful).*[₹Rs.INR]*\s*[\d,]+/i, weight: 0.85 },
        ],
        excludePatterns: [
            /promotion|offer|discount|coupon|deal|bonus|apply\s+(?:for|now)/i,
            /otp|verification|confirm.*(?:email|identity|account)/i,
            /request\s+received/i // "We received your request for transaction..."
        ],
    },

    DEBIT_ALERT: {
        priority: 10,
        isTransaction: true,
        transactionType: 'bank_debit',
        direction: 'debit',
        keywords: [
            { pattern: /[₹Rs.INR]*\s*[\d,]+\.?\d*\s+(?:debited|withdrawn|deducted|charged)\s+(?:from|via)/i, weight: 1.0 },
            { pattern: /debit\s+(?:alert|notification).*[₹Rs.INR]*\s*[\d,]+/i, weight: 0.95 },
            { pattern: /card\s+[*x#]?\d{0,4}\s+(?:debited|charged|used)/i, weight: 0.9 },
            { pattern: /atm\s+(?:withdrawal|cash).*[₹Rs.INR]*\s*[\d,]+/i, weight: 0.9 },
            { pattern: /(?:neft|imps|rtgs)\s+(?:transfer|sent).*[₹Rs.INR]*\s*[\d,]+/i, weight: 0.85 },
        ],
        excludePatterns: [
            /limit.*exceeded|insufficient|failed|declined/i,
        ],
    },

    CREDIT_ALERT: {
        priority: 9,
        isTransaction: true,
        transactionType: 'bank_credit',
        direction: 'credit',
        keywords: [
            { pattern: /[₹Rs.INR]*\s*[\d,]+\.?\d*\s+(?:credited|received|deposited)\s+(?:to|in)/i, weight: 1.0 },
            { pattern: /credit\s+(?:alert|notification).*[₹Rs.INR]*\s*[\d,]+/i, weight: 0.95 },
            { pattern: /(?:salary|income|bonus|incentive)\s+.*[₹Rs.INR]*\s*[\d,]+/i, weight: 0.9 },
            { pattern: /(?:neft|imps|rtgs)\s+(?:received|credited).*[₹Rs.INR]*\s*[\d,]+/i, weight: 0.9 },
            { pattern: /fund\s+transfer.*received.*[₹Rs.INR]*\s*[\d,]+/i, weight: 0.85 },
        ],
    },

    UPI_DEBIT: {
        priority: 10,
        isTransaction: true,
        transactionType: 'bank_upi_debit',
        direction: 'debit',
        keywords: [
            { pattern: /upi\s+(?:payment|debit|transaction).*[₹Rs.INR]*\s*[\d,]+/i, weight: 1.0 },
            { pattern: /(?:gpay|google\s+pay|phonepe|paytm|bhim)\s+.*[₹Rs.INR]*\s*[\d,]+\s+(?:sent|paid|debited)/i, weight: 0.95 },
            { pattern: /[₹Rs.INR]*\s*[\d,]+\s+(?:sent|paid)\s+via\s+upi/i, weight: 0.95 },
            { pattern: /vpa.*@.*debited/i, weight: 0.9 },
        ],
    },

    UPI_CREDIT: {
        priority: 9,
        isTransaction: true,
        transactionType: 'bank_upi_credit',
        direction: 'credit',
        keywords: [
            { pattern: /upi\s+(?:credit|received).*[₹Rs.INR]*\s*[\d,]+/i, weight: 1.0 },
            { pattern: /(?:gpay|google\s+pay|phonepe|paytm|bhim)\s+.*[₹Rs.INR]*\s*[\d,]+\s+(?:received|credited)/i, weight: 0.95 },
            { pattern: /[₹Rs.INR]*\s*[\d,]+\s+(?:received)\s+via\s+upi/i, weight: 0.95 },
            { pattern: /vpa.*@.*credited/i, weight: 0.9 },
        ],
    },

    REFUND: {
        priority: 9,
        isTransaction: true,
        transactionType: 'refund',
        direction: 'credit',
        keywords: [
            { pattern: /refund\s+(?:of|for|processed|initiated|successful).*[₹Rs.INR]*\s*[\d,]+/i, weight: 1.0 },
            { pattern: /[₹Rs.INR]*\s*[\d,]+\s+(?:refunded|refund|reversed)/i, weight: 0.95 },
            { pattern: /(?:order|transaction|payment)\s+.*(?:cancelled|reversed).*[₹Rs.INR]*\s*[\d,]+/i, weight: 0.9 },
            { pattern: /chargeback.*[₹Rs.INR]*\s*[\d,]+/i, weight: 0.85 },
        ],
    },

    // ============================================
    // MEDIUM PRIORITY PATTERNS (5-7)
    // ============================================

    BILL_PAYMENT: {
        priority: 7,
        isTransaction: true,
        transactionType: 'bill_payment',
        direction: 'debit',
        keywords: [
            { pattern: /(?:bill|electricity|water|gas|telephone|mobile|broadband)\s+(?:payment|paid)/i, weight: 0.95 },
            { pattern: /utility\s+payment.*[₹Rs.INR]*\s*[\d,]+/i, weight: 0.9 },
            { pattern: /(?:recharge|top-up)\s+.*[₹Rs.INR]*\s*[\d,]+/i, weight: 0.85 },
        ],
    },

    SUBSCRIPTION: {
        priority: 7,
        isTransaction: true,
        transactionType: 'subscription',
        direction: 'debit',
        keywords: [
            { pattern: /subscription\s+(?:charge|renewal|payment|fee)/i, weight: 0.95 },
            { pattern: /recurring\s+(?:charge|payment|debit)/i, weight: 0.9 },
            { pattern: /(?:monthly|annual|yearly)\s+(?:charge|fee|subscription|membership)/i, weight: 0.85 },
            { pattern: /auto-?(?:debit|pay|renewal)/i, weight: 0.8 },
        ],
    },

    EMI_PAYMENT: {
        priority: 7,
        isTransaction: true,
        transactionType: 'emi_payment',
        direction: 'debit',
        keywords: [
            { pattern: /emi\s+(?:payment|debit|due|deducted)/i, weight: 0.95 },
            { pattern: /(?:instalment|installment)\s+(?:payment|due)/i, weight: 0.9 },
            { pattern: /loan\s+(?:repayment|emi)/i, weight: 0.9 },
            { pattern: /(?:bajaj|hdfc|icici)\s+(?:finserv|finance).*emi/i, weight: 0.85 },
        ],
    },

    CASHBACK_REWARD: {
        priority: 6,
        isTransaction: true,
        transactionType: 'cashback',
        direction: 'credit',
        keywords: [
            { pattern: /cashback\s+(?:of|credited|earned|rewarded).*[₹Rs.INR]*\s*[\d,]+/i, weight: 0.95 },
            { pattern: /reward\s+(?:points?|credited).*[₹Rs.INR]*\s*[\d,]+/i, weight: 0.9 },
            { pattern: /points?\s+(?:earned|credited|redeemed)/i, weight: 0.85 },
        ],
    },

    STATEMENT: {
        priority: 6,
        isTransaction: false,
        keywords: [
            { pattern: /(?:credit\s+card|account)\s+statement/i, weight: 0.95 },
            { pattern: /e-?statement\s+(?:ready|available|generated)/i, weight: 0.9 },
            { pattern: /billing\s+statement/i, weight: 0.85 },
        ],
    },

    // ============================================
    // LOW PRIORITY / REJECTION PATTERNS (1-4)
    // ============================================

    // OTP_SECURITY moved to top as OTP_EXCLUSION with high priority


    PROMOTIONAL: {
        priority: 1,
        isTransaction: false,
        keywords: [
            { pattern: /apply\s+(?:for|now).*(?:credit|debit)\s+card/i, weight: 0.95 },
            { pattern: /(?:get|receive|earn).*(?:credit|debit)\s+card.*(?:free|offer)/i, weight: 0.9 },
            { pattern: /(?:exclusive|limited|special).*(?:offer|deal|discount)/i, weight: 0.85 },
            { pattern: /pre[- ]?approved.*(?:loan|credit|card)/i, weight: 0.8 },
            { pattern: /complimentary\s+(?:card|offer)/i, weight: 0.8 },
        ],
    },

    MARKETING: {
        priority: 1,
        isTransaction: false,
        keywords: [
            { pattern: /unsubscribe|email\s+preferences/i, weight: 0.95 },
            { pattern: /newsletter|blog|news\s+update/i, weight: 0.9 },
            { pattern: /advertisement|sponsored|partner\s+offer/i, weight: 0.85 },
        ],
    },
};

// ============================================
// BANK PATTERNS FOR SENDER VALIDATION
// ============================================

export const BANK_PATTERNS: Record<string, {
    domains: string[];
    displayName: string;
}> = {
    hdfc: { domains: ['hdfc', 'hdfcbank'], displayName: 'HDFC Bank' },
    icici: { domains: ['icici', 'icicibank'], displayName: 'ICICI Bank' },
    axis: { domains: ['axis', 'axisbank'], displayName: 'Axis Bank' },
    sbi: { domains: ['sbi', 'statebank', 'onlinesbi'], displayName: 'State Bank of India' },
    indusind: { domains: ['indusind', 'indusindbank'], displayName: 'IndusInd Bank' },
    kotak: { domains: ['kotak', 'kotakbank', 'kotak811'], displayName: 'Kotak Mahindra Bank' },
    yes: { domains: ['yesbank'], displayName: 'Yes Bank' },
    bob: { domains: ['bankofbaroda', 'bob'], displayName: 'Bank of Baroda' },
    pnb: { domains: ['pnb', 'pnbindia'], displayName: 'Punjab National Bank' },
    canara: { domains: ['canarabank'], displayName: 'Canara Bank' },
    union: { domains: ['unionbank', 'unionbankofindia'], displayName: 'Union Bank of India' },
    idbi: { domains: ['idbi', 'idbibank'], displayName: 'IDBI Bank' },
    hsbc: { domains: ['hsbc'], displayName: 'HSBC' },
    citi: { domains: ['citi', 'citibank'], displayName: 'Citibank' },
    amex: { domains: ['americanexpress', 'amex'], displayName: 'American Express' },
    rbl: { domains: ['rblbank'], displayName: 'RBL Bank' },
    federal: { domains: ['federalbank'], displayName: 'Federal Bank' },
    idfc: { domains: ['idfcfirst', 'idfc'], displayName: 'IDFC First Bank' },
    au: { domains: ['aubank'], displayName: 'AU Small Finance Bank' },

    // Digital banks / Fintech
    jupiter: { domains: ['jupiter'], displayName: 'Jupiter' },
    fi: { domains: ['fi.money', 'epifi'], displayName: 'Fi Money' },
    niyo: { domains: ['niyo', 'goniyo'], displayName: 'Niyo' },
    slice: { domains: ['slice'], displayName: 'Slice' },
    cred: { domains: ['cred'], displayName: 'CRED' },

    // UPI/Wallets
    gpay: { domains: ['google', 'googleplay'], displayName: 'Google Pay' },
    phonepe: { domains: ['phonepe'], displayName: 'PhonePe' },
    paytm: { domains: ['paytm'], displayName: 'Paytm' },
    amazonpay: { domains: ['amazon'], displayName: 'Amazon Pay' },

    // Credit Cards
    bajaj: { domains: ['bajaj', 'bajajfinserv'], displayName: 'Bajaj Finserv' },
    onecard: { domains: ['onecard', 'getonecard'], displayName: 'OneCard' },
    uni: { domains: ['uni'], displayName: 'Uni Cards' },
};

/**
 * Check if a sender email is from a known bank
 */
export function isKnownBankSender(senderEmail?: string): {
    isKnown: boolean;
    bankName?: string;
} {
    if (!senderEmail) return { isKnown: false };

    const emailLower = senderEmail.toLowerCase();

    for (const [key, bank] of Object.entries(BANK_PATTERNS)) {
        if (bank.domains.some(domain => emailLower.includes(domain))) {
            return { isKnown: true, bankName: bank.displayName };
        }
    }

    return { isKnown: false };
}
