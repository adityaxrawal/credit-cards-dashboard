export const Patterns = {
    // Monetary Patterns (Currency-agnostic, generic)
    // Matches: ₹123, Rs. 123, INR 123.00, $123, 123.45
    // Note: We use a loose match to catch various formats, specific validation happens in extractor.
    // We look for currency symbols or codes followed by digits.
    MONEY: /(?:(?:Rs\.?|INR|₹|\$|USD|EUR|GBP)\s*?[\d,\.]+|\b[\d,\.]+\s*(?:INR|USD|EUR|GBP))\b/i,
    MONEY_STRICT: /(?:Rs\.?|INR|₹|\$|USD|EUR|GBP)\s*?([0-9,]+(?:\.[0-9]+)?)/i,

    // Semantic Keywords for Transactions (Spend/Debit intent)
    TRANSACTION_VERBS: [
        'spent',
        'debited',
        'charged',
        'purchase of',
        'transaction',
        'payment successful',
        'used at',
        'paid to'
    ],

    // Semantic Keywords for Statements
    STATEMENT_KEYWORDS: [
        'statement',
        'e-statement',
        'billing cycle',
        'total amount due',
        'minimum amount due',
        'payment due date',
        'attached herewith',
        'statement period'
    ],

    // Card References
    CARD_REF: [
        'credit card',
        'card no',
        'card ending',
        'ending with',
        'ending in'
    ],
    // Common masked card patterns: XX1234, **1234, XXXXX1234
    MASKED_CARD: /(?:X{2,}|\*{2,})[0-9]{4}/,

    // Networks
    NETWORKS: ['visa', 'mastercard', 'rupay', 'amex', 'diners'],

    // Noise / Non-Transaction Exclusion
    // If these matches WITHOUT a clear "spent" verb, it's likely a bill/reminder.
    NOISE: [
        'total amount due',
        'minimum amount due',
        'credit limit',
        'available limit',
        'outstanding',
        'payment received', // This is a credit, not a spend
        'refund',
        'loan',
        'offer'
    ],

    // Date Anchors
    DATE_ANCHORS: [
        'on',
        'dated',
        'date:'
    ]
};
