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
    // EXPLICIT REJECTIONS (Noise Filter) - Highest Priority
    // ============================================
    NOISE_FILTER: {
        priority: 100,
        isTransaction: false,
        transactionType: 'non_financial',
        keywords: [
            // DevOps / Code
            { pattern: /deployment/i, weight: 10.0 },
            { pattern: /pull request/i, weight: 10.0 },
            { pattern: /preview/i, weight: 10.0 },
            { pattern: /Review Requested/i, weight: 10.0 },
            { pattern: /github/i, weight: 5.0 },
            { pattern: /vercel/i, weight: 5.0 },

            // Security / Alerts (Non-Transactional)
            { pattern: /reset\s+your\s+pin/i, weight: 10.0 },
            { pattern: /security\s+alert/i, weight: 10.0 },
            { pattern: /device\s+login/i, weight: 10.0 },
            { pattern: /suspended\s+if\s+not\s+activated/i, weight: 10.0 }, // IndusInd warning
            { pattern: /kyc/i, weight: 10.0 }, // ReKYC
            { pattern: /update\s+regarding\s+your/i, weight: 5.0 }, // Generic updates

            // Social / Other
            { pattern: /messaged\s+you/i, weight: 10.0 },
            { pattern: /invitation/i, weight: 10.0 },

            // Recruitment / Job Applications (High Volume Noise)
            { pattern: /application.*(?:received|viewed|status|update|sent|review)/i, weight: 10.0 },
            { pattern: /regarding.*application/i, weight: 10.0 },
            { pattern: /received.*application/i, weight: 10.0 }, // "Reuters received your application"
            { pattern: /thank\s+you\s+for\s+applying/i, weight: 10.0 },
            { pattern: /thanks\s+for\s+applying/i, weight: 10.0 },
            // NEW RULES
            { pattern: /job.*alert/i, weight: 10.0 },
            { pattern: /jobs.*you.*might.*be.*interested/i, weight: 10.0 },
            { pattern: /recommended.*jobs/i, weight: 10.0 },
            { pattern: /talent.*network/i, weight: 10.0 },
            { pattern: /glassdoor/i, weight: 10.0 },
            { pattern: /job.*recommendation/i, weight: 10.0 },
            { pattern: /apply.*now/i, weight: 10.0 },
            { pattern: /interview/i, weight: 10.0 },
            { pattern: /statement.*available/i, weight: 10.0 },
            { pattern: /login.*alert/i, weight: 10.0 },
            { pattern: /otp/i, weight: 10.0 },

            // Phase 4: Expanded Noise
            { pattern: /you\s+have\s+a\s+new\s+message/i, weight: 10.0 }, // LinkedIn/Social
            { pattern: /updates?.*privacy\s+policy/i, weight: 10.0 },
            { pattern: /security\s+alert/i, weight: 10.0 },
            { pattern: /renew\s+policy/i, weight: 5.0 }, // PolicyBazaar noise
            { pattern: /policy\s+expired/i, weight: 5.0 },
            { pattern: /review\s+of\s+charges/i, weight: 5.0 },
            { pattern: /sankalp\s+pooja/i, weight: 5.0 },
            { pattern: /software\s+engineer/i, weight: 5.0 }, // Job titles
            { pattern: /interesting\s+opportunities/i, weight: 5.0 },
            { pattern: /submitted\s+application/i, weight: 10.0 },
            { pattern: /jobs?.*for\s+you/i, weight: 10.0 },
            { pattern: /recruit(?:er|ing|ment)/i, weight: 10.0 },
            { pattern: /talent\s+acquisition/i, weight: 10.0 },
            { pattern: /career|hiring/i, weight: 5.0 },
            { pattern: /workday/i, weight: 10.0 }, // Workday notifications
            { pattern: /greenhouse/i, weight: 10.0 }, // Greenhouse ATS
            { pattern: /hirist/i, weight: 10.0 },
            { pattern: /indeed/i, weight: 10.0 },
            { pattern: /naukri/i, weight: 10.0 },
            { pattern: /foundit/i, weight: 10.0 },
            { pattern: /cutshort/i, weight: 10.0 },
            { pattern: /cfa\s+institute/i, weight: 8.0 },
            { pattern: /coursera/i, weight: 10.0 }, // Coursera is education noise
            { pattern: /financial\s+aid/i, weight: 10.0 },
            { pattern: /cv\s+reviewed/i, weight: 10.0 },

            // Rewards / Non-Monetary
            { pattern: /bluchips\s+earned/i, weight: 10.0 },
            { pattern: /miles\s+earned/i, weight: 5.0 },
            { pattern: /joined\s+your\s+family/i, weight: 10.0 }, // Apple Family Sharing

            // Generic Alerts (Non-Transactional)
            { pattern: /account\s+update/i, weight: 5.0 },
            { pattern: /balance\s+notification/i, weight: 5.0 }, // HDFC "New A/c Balance Notification"
            { pattern: /balance\s+is\s+below/i, weight: 5.0 },
            { pattern: /biometric\s+login/i, weight: 5.0 },
            { pattern: /login\s+pin/i, weight: 5.0 },
            { pattern: /device\s+for\s+mobilebanking/i, weight: 5.0 },
            { pattern: /alert\s+triggered/i, weight: 8.0 }, // Price alerts
            // Phase 4 Extensions
            { pattern: /digest|newsletter|edition|brief/i, weight: 10.0 }, // News
            { pattern: /update\s+on\s+dark\s+web/i, weight: 10.0 },
            { pattern: /fraud|advisory|maintenance/i, weight: 10.0 },
            { pattern: /support|ticket|contacting\s+us/i, weight: 10.0 },
            { pattern: /credit\s+limit\s+increase/i, weight: 10.0 },
            { pattern: /sound\s+was\s+played/i, weight: 10.0 }, // Find My
            { pattern: /lot\s+size|stock\s+split/i, weight: 10.0 },
            { pattern: /relationship\s+manager/i, weight: 10.0 },
            { pattern: /refund\s+request/i, weight: 10.0 }, // Request received/decision
            { pattern: /verify\s+your\s+email/i, weight: 10.0 },
            { pattern: /confirm\s+your\s+application/i, weight: 10.0 },
            { pattern: /welcome\s+aboard|welcome\s+to/i, weight: 5.0 }, // Generic welcomes
            { pattern: /survey|feedback|opinion/i, weight: 10.0 },
        ]
    },

    STATEMENT_READY: {
        priority: 20,
        isTransaction: false,
        transactionType: 'statement_ready',
        keywords: [
            { pattern: /statement.*is.*ready/i, weight: 2.0 },
            { pattern: /your.*monthly.*statement/i, weight: 2.0 },
            { pattern: /e-?statement.*for/i, weight: 2.0 },
            { pattern: /account.*statement/i, weight: 2.0 },
            { pattern: /consolidated.*statement/i, weight: 2.0 },
            { pattern: /statement.*period/i, weight: 1.5 }
        ]
    },
    ALERT_NOISE: {
        priority: 95,
        isTransaction: false,
        transactionType: 'non_financial',
        keywords: [
            { pattern: /alert.*triggered/i, weight: 2.0 },
            { pattern: /price.*alert/i, weight: 2.0 },
            { pattern: /stock.*alert/i, weight: 2.0 },
            { pattern: /market.*update/i, weight: 2.0 },
            { pattern: /trading.*view/i, weight: 2.0 }
        ]
    },
    APPLE_NOISE: {
        priority: 95,
        isTransaction: false,
        transactionType: 'non_financial',
        keywords: [
            { pattern: /icloud.*storage/i, weight: 2.0 },
            { pattern: /storage.*is.*full/i, weight: 2.0 },
            { pattern: /subscription.*expiring/i, weight: 2.0 },
            { pattern: /payment.*problem/i, weight: 2.0 },

            // Phase 5: Long Tail Noise
            { pattern: /maharaja.*club.*enrolment/i, weight: 10.0 }, // Air India
            { pattern: /cfa.*exam.*appointment/i, weight: 10.0 },
            { pattern: /verification.*in.*progress/i, weight: 10.0 },
            { pattern: /action.*required.*verify.*account/i, weight: 10.0 },
            { pattern: /otp.*for.*online.*transaction/i, weight: 10.0 },
            { pattern: /important.*update.*credit.*card/i, weight: 5.0 }, // Generic bank updates

            // Phase 6: Deep Mining Noise
            { pattern: /new.*matches.*on.*himalayas/i, weight: 10.0 }, // Recruitment
            { pattern: /opportunities.*at.*dp.*world/i, weight: 10.0 }, // Recruitment
            { pattern: /binance.*login.*verification/i, weight: 10.0 },
            { pattern: /permanently.*delete.*my.*account/i, weight: 10.0 },
            { pattern: /payment.*unsuccessful/i, weight: 10.0 },
            { pattern: /transaction.*failed/i, weight: 5.0 }
        ]
    },

    // ============================================
    // LIFESTYLE & SERVICES (Low Priority)
    // ============================================
    RIDE_APP: {
        priority: 60,
        isTransaction: true,
        transactionType: 'transport',
        keywords: [
            { pattern: /ride\s+with\s+ola/i, weight: 2.0 },
            { pattern: /your\s+ride\s+with\s+uber/i, weight: 2.0 },
            { pattern: /uber\s+receipt/i, weight: 2.0 },
            { pattern: /(?:rapido|blusmart).*(?:ride|trip|invoice)/i, weight: 2.0 },
            { pattern: /total\s+fare/i, weight: 0.5 } // Broad but boosted by subject
        ]
    },
    FOOD_DELIVERY: {
        priority: 60,
        isTransaction: true,
        transactionType: 'food',
        keywords: [
            { pattern: /order.*?swiggy/i, weight: 2.0 },
            { pattern: /your\s+order\s+from\s+zomato/i, weight: 2.0 },
            { pattern: /zomato.*?order\s+summary/i, weight: 2.0 },
            { pattern: /blinkit/i, weight: 2.0 },
            { pattern: /(?:eatsure|zepto|instamart).*(?:order|delivered)/i, weight: 2.0 }
        ]
    },

    // ============================================
    // HIGH PRIORITY BANK SPECIFIC (90-99)
    // ============================================
    // Jupiter
    JUPITER_UPI_SPEND: {
        priority: 25,
        isTransaction: true,
        transactionType: 'bank_upi_debit',
        direction: 'debit',
        keywords: [
            { pattern: /You\s+paid\s+(?:Rs\.?|INR|₹)/i, weight: 1.0 },
            { pattern: /to\s+.*\s+from\s+your\s+Jupiter\s+account/i, weight: 1.0 },
            { pattern: /jupiteraxis/i, weight: 0.8 } // VPA handle
        ]
    },
    JUPITER_CC_SPEND: { // RuPay
        priority: 25,
        isTransaction: true,
        transactionType: 'cc_spend',
        direction: 'debit',
        keywords: [
            { pattern: /You\s+paid\s+(?:Rs\.?|INR|₹).*?Paid\s+to/i, weight: 1.0 },
            { pattern: /CSB\s+Bank/i, weight: 0.5 }
        ]
    },
    JUPITER_POT_TRANSFER: {
        priority: 25,
        isTransaction: true,
        transactionType: 'transfer',
        direction: 'debit', // Money moving to pot is debit from main account usually, or internal transfer
        keywords: [
            { pattern: /Money\s+added\s+to\s+Pot/i, weight: 1.0 },
            { pattern: /moving\s+closer\s+to\s+your\s+dream/i, weight: 0.5 }
        ]
    },
    JUPITER_POT_WITHDRAWAL: {
        priority: 25,
        isTransaction: true,
        transactionType: 'transfer',
        direction: 'credit', // Back to main account
        keywords: [
            { pattern: /Money\s+withdrawn\s+from\s+Pots/i, weight: 1.0 }
        ]
    },

    // Fees
    DEMAT_CHARGES: {
        priority: 25,
        isTransaction: true,
        transactionType: 'fee',
        direction: 'debit',
        keywords: [
            { pattern: /account\s+maintenance\s+charge/i, weight: 1.0 },
            { pattern: /Demat\s+account/i, weight: 0.5 }
        ]
    },

    // Statements
    AXIS_STATEMENT: {
        priority: 25,
        isTransaction: false, // It's a statement, not a transaction line item
        transactionType: 'statement_ready',
        keywords: [
            { pattern: /Axis\s+Bank\s+.*Credit\s+Card\s+Statement/i, weight: 1.0 }
        ]
    },

    HDFC_UPI_DEBIT: {
        priority: 25,
        isTransaction: true,
        transactionType: 'bank_upi_debit',
        direction: 'debit',
        keywords: [
            { pattern: /You\s+have\s+done\s+a\s+UPI\s+txn/i, weight: 1.0 },
            { pattern: /Is\s+debited\s+from\s+account\s+\d+\s+to\s+VPA/i, weight: 0.95 },
            { pattern: /has\s+been\s+debited\s+from\s+account/i, weight: 0.95 }
        ]
    },

    SBI_CC_SPEND: {
        priority: 25,
        isTransaction: true,
        transactionType: 'cc_spend',
        direction: 'debit',
        keywords: [
            { pattern: /Transaction\s+Alert\s+from.*SBI\s+Card/i, weight: 1.0 },
            { pattern: /spent\s+on\s+your\s+SBI\s+Credit\s+Card/i, weight: 1.0 }
        ]
    },



    HDFC_CC_SPEND: {
        priority: 25,
        isTransaction: true,
        transactionType: 'cc_spend',
        direction: 'debit',
        keywords: [
            { pattern: /debited\s+via\s+Credit\s+Card\s+.*\*\*/i, weight: 1.0 },
            { pattern: /debited\s+from\s+your\s+HDFC\s+Bank\s+Credit\s+Card/i, weight: 1.0 }
        ]
    },

    AXIS_CC_SPEND: {
        priority: 25,
        isTransaction: true,
        transactionType: 'cc_spend',
        direction: 'debit',
        keywords: [
            { pattern: /Transaction\s+alert\s+on\s+Axis\s+Bank\s+Credit\s+Card/i, weight: 1.0 }
        ]
    },

    SLICE_UPI: {
        priority: 25,
        isTransaction: true,
        transactionType: 'bank_upi_credit',
        direction: 'credit',
        keywords: [
            { pattern: /Received\s+[₹Rs.INR]*\s*[\d,]+\s+via\s+UPI/i, weight: 1.0 }
        ]
    },

    HDFC_DEPOSIT: {
        priority: 25,
        isTransaction: true,
        transactionType: 'bank_credit',
        direction: 'credit',
        keywords: [
            { pattern: /New\s+Deposit\s+Alert/i, weight: 1.0 }
        ]
    },

    APPLE_SPEND: {
        priority: 25,
        isTransaction: true,
        transactionType: 'cc_spend', // It's a receipt, assumes CC/Debit usage
        direction: 'debit',
        keywords: [
            { pattern: /Your\s+invoice\s+from\s+Apple/i, weight: 1.0 }
        ]
    },

    YES_BANK_SPEND: {
        priority: 25,
        isTransaction: true,
        transactionType: 'bank_debit', // Could be CC or Bank, default to debit
        direction: 'debit',
        keywords: [
            { pattern: /YES\s+BANK\s+-\s+Transaction\s+Alert/i, weight: 1.0 }
        ]
    },

    // ============================================
    // HIGH PRIORITY TRANSACTION PATTERNS (8-10)
    // ============================================

    PAYMENT_RECEIVED: {
        priority: 11,
        isTransaction: true,
        transactionType: 'cc_payment',
        direction: 'credit',
        keywords: [
            { pattern: /(?:payment|transaction)\s+(?:received|credited|thank\s+you)/i, weight: 1.0 },
            { pattern: /thank\s+you\s+for\s+(?:making|your)\s+payment/i, weight: 1.0 },
            { pattern: /payment\s+(?:of|for)?\s*[₹Rs.INR]*\s*[\d,]+\s+(?:received|credited)/i, weight: 0.95 },
            { pattern: /credited\s+your\s+(?:card|account)\s+with\s+(?:payment|amount)/i, weight: 0.9 },
        ],
        excludePatterns: [
            /will\s+be\s+(?:received|credited)/i, // Future tense
            /fail|decline/i
        ]
    },

    // ============================================
    // CRITICAL PRIORITY (11+)
    // ============================================

    BILL_REMINDER: {
        priority: 11,
        isTransaction: false,
        keywords: [
            { pattern: /(?:bill|payment|amount)\s+(?:due|overdue|outstanding)/i, weight: 1.0 },
            { pattern: /total\s+(?:amount)?\s+due.*[₹Rs.INR]*/i, weight: 0.95 },
            { pattern: /(?:bill|statement|e-?statement).{0,30}\s+(?:generated|available|ready)/i, weight: 1.0 },
            { pattern: /(?:bill|payment)\s+for\s+.{0,50}\s+due\s+on/i, weight: 1.0 },
            { pattern: /pay\s+(?:bill|dues|outstanding)\s+now/i, weight: 0.95 },
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
            { pattern: /login\s+alert|new\s+device\s+detected/i, weight: 0.9 },
            { pattern: /OTP\s+for\s+Dhan\s+Login/i, weight: 1.0 }
        ]
    },

    PAYMENT_CONFIRMATION: {
        priority: 10,
        isTransaction: true,
        transactionType: 'cc_spend',
        direction: 'debit',
        keywords: [
            // Strict: "Transaction of Rs 500" - Must have currency or be very clear
            { pattern: /(?:your\s+)?(?:payment|transaction)\s+(?:of|for)?\s*[₹Rs.INR]+[\s.]*[\d,]+(?:\.\d{2})?/i, weight: 1.0 },
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
            { pattern: /[₹Rs.INR]*\s*[\d,]+\.?\d*\s+(?:debited|withdrawn|deducted|charged)\s+(?:from|via|to)/i, weight: 1.0 },
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
            // Missing IMPS patterns
            { pattern: /(?:received|credited)\s+[₹Rs.INR]*\s*[\d,]+\s+via\s+(?:imps|neft|rtgs)/i, weight: 1.0 },
            { pattern: /money\s+credited\s+to\s+your.*account/i, weight: 1.0 },
            { pattern: /money\s+credited\s+to\s+your.*account/i, weight: 1.0 },
        ],
        excludePatterns: [
            /job|interview|application|hiring|recruit|career/i,
            /apply\s+now|referral|bonus\s+points/i
        ]
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
        priority: 12,
        isTransaction: true,
        transactionType: 'refund',
        direction: 'credit',
        keywords: [
            { pattern: /refund\s+(?:of|for|processed|initiated|successful).*(?:₹|Rs\.?|INR)?\s*[\d,]+/i, weight: 1.0 },
            { pattern: /(?:₹|Rs\.?|INR)?\s*[\d,]+\s+(?:refunded|refund|reversed)/i, weight: 0.95 },
            { pattern: /(?:order|transaction|payment)\s+.*(?:cancelled|reversed).*(?:₹|Rs\.?|INR)?\s*[\d,]+/i, weight: 0.9 },
            { pattern: /chargeback.*(?:₹|Rs\.?|INR)?\s*[\d,]+/i, weight: 0.85 },
            { pattern: /reversal\s+of\s+transaction/i, weight: 0.9 },
        ],
        excludePatterns: [
            /refund\s+policy/i,
            /return\s+policy/i,
            /cancellation\s+policy/i
        ]
    },

    CC_UPI_SPEND: {
        priority: 11,
        isTransaction: true,
        transactionType: 'cc_upi',
        direction: 'debit',
        keywords: [
            { pattern: /upi\s+txn\s+on\s+(?:rupay|credit)\s+card/i, weight: 1.0 },
            { pattern: /debited\s+from\s+your\s+(?:rupay|credit)\s+card/i, weight: 0.95 },
            { pattern: /transaction\s+on\s+your\s+rupay\s+credit\s+card/i, weight: 0.95 },
        ]
    },

    CC_POS_SPEND: {
        priority: 10,
        isTransaction: true,
        transactionType: 'cc_spend',
        direction: 'debit',
        keywords: [
            { pattern: /spent\s+on\s+credit\s+card/i, weight: 0.95 },
            { pattern: /debited\s+from\s+your\s+hdfc\s+bank\s+credit\s+card/i, weight: 0.95 }, // Specific HDFC Format
            { pattern: /payment\s+was\s+successful/i, weight: 0.9 }, // Generic success
        ]
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
            { pattern: /recurring\s+(?:charge|payment|debit|e-mandate)/i, weight: 0.9 },
            { pattern: /e-mandate\s+(?:registered|debit).*[₹Rs.INR]*\s*[\d,]+/i, weight: 0.95 },
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
    // SPECIFIC CATEGORY PATTERNS (12 - Override Generics)
    // ============================================

    INVESTMENT: {
        priority: 12,
        isTransaction: true,
        transactionType: 'investment',
        direction: 'debit',
        keywords: [
            { pattern: /sip\s+(?:instalment|installment|deducted|auto-pay)/i, weight: 1.0 },
            { pattern: /mutual\s+fund.*(?:purchase|unit|allotted)/i, weight: 0.95 },
            { pattern: /processing.*of.*purchase.*in.*(?:kotak|hsbc).*mutual.*fund/i, weight: 2.0 }, // Phase 6
            { pattern: /(?:groww|zerodha|upstox|kuvera|coin|smallcase).*(?:order|payment)/i, weight: 0.95 },
            { pattern: /folio\s+no|unit\s+price|nav:/i, weight: 0.9 },
            { pattern: /investment\s+(?:of|amount).*[₹Rs.INR]*\s*[\d,]+/i, weight: 0.9 },
            { pattern: /redemption.*(?:tsxn|id)/i, weight: 0.95 },
        ]
    },

    MF_REDEMPTION: {
        priority: 12,
        isTransaction: true,
        transactionType: 'investment', // Or create 'redemption' type if needed
        direction: 'credit',
        keywords: [
            { pattern: /Receipt\s+of\s+Redemption\s+Trxn/i, weight: 1.0 }
        ]
    },

    CRYPTO_TRADE: {
        priority: 12,
        isTransaction: true,
        transactionType: 'investment',
        direction: 'debit', // Default
        keywords: [
            { pattern: /New\s+kills\s+for\s+your/i, weight: 1.0 }, // Typo in email? "kills"? log said "fills"
            { pattern: /New\s+fills\s+for\s+your/i, weight: 1.0 },
            { pattern: /Liquidation\s+Alert/i, weight: 1.0 },
            { pattern: /Delta\s+Exchange/i, weight: 0.5 }
        ]
    },

    TRAVEL: {
        priority: 12,
        isTransaction: true,
        transactionType: 'travel',
        direction: 'debit',
        keywords: [
            { pattern: /(?:booking|pnr).*(?:confirmed|id)/i, weight: 0.95 },
            { pattern: /(?:flight|train|bus|hotel)\s+(?:booking|reservation)/i, weight: 0.95 },
            { pattern: /(?:irctc|makemytrip|goibibo|easemytrip|cleartrip|cabs|indigo|vistara|air\s+india).*(?:booking|payment)/i, weight: 0.95 },
            { pattern: /ticket.*(?:booked|confirmed).*[₹Rs.INR]*\s*[\d,]+/i, weight: 0.9 },
        ]
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

    // ============================================
    // NEW TRANSACTION TYPES (Phase 2 Implementation)
    // ============================================

    BANK_CHARGE: {
        priority: 12,
        isTransaction: true,
        transactionType: 'bank_charge',
        direction: 'debit',
        keywords: [
            { pattern: /(?:annual|membership|joining|renewal)\s+fee/i, weight: 1.0 },
            { pattern: /(?:account|a\/c)\s+maintenance\s+(?:fee|charge)/i, weight: 1.0 },
            { pattern: /(?:min|minimum)\s+balance\s+(?:charge|fee|penalty)/i, weight: 1.0 },
            { pattern: /sms\s+(?:alert)?\s*(?:fee|charge)/i, weight: 0.9 },
            { pattern: /late\s+payment\s+(?:fee|charge|penalty)/i, weight: 1.0 },
            { pattern: /penal\s+(?:interest|charge)/i, weight: 1.0 },
            { pattern: /(?:atm|cash)\s+(?:withdrawal|transaction)\s+(?:fee|charge)/i, weight: 0.9 },
            { pattern: /demat\s+(?:account)?\s*(?:maintenance|charge)/i, weight: 0.95 },
            { pattern: /service\s+charge/i, weight: 0.8 },
        ],
        excludePatterns: [
            /will\s+be\s+(?:charged|debited)/i,
        ]
    },

    INTEREST_CREDIT: {
        priority: 11,
        isTransaction: true,
        transactionType: 'interest_credit',
        direction: 'credit',
        keywords: [
            { pattern: /interest\s+(?:credited|credit|earned|received)/i, weight: 1.0 },
            { pattern: /(?:savings|fd|fixed\s+deposit|rd).*interest.*credited/i, weight: 1.0 },
            { pattern: /quarterly\s+interest\s+(?:credited|paid)/i, weight: 1.0 },
            { pattern: /interest\s+(?:for|of)\s+(?:quarter|month|period)/i, weight: 0.9 },
        ],
    },

    INTEREST_DEBIT: {
        priority: 11,
        isTransaction: true,
        transactionType: 'interest_debit',
        direction: 'debit',
        keywords: [
            { pattern: /interest\s+(?:debited|debit|charged|deducted)/i, weight: 1.0 },
            { pattern: /(?:overdraft|od).*interest.*(?:debited|charged)/i, weight: 1.0 },
            { pattern: /penal\s+interest/i, weight: 1.0 },
            { pattern: /interest\s+on\s+(?:overdue|outstanding)/i, weight: 0.9 },
        ],
    },

    CHEQUE_DEPOSIT: {
        priority: 11,
        isTransaction: true,
        transactionType: 'cheque_deposit',
        direction: 'credit',
        keywords: [
            { pattern: /cheque\s+(?:deposited|credit|cleared)/i, weight: 1.0 },
            { pattern: /(?:chq|cheque)\s+no\.?\s*\d+\s+(?:credited|deposited|cleared)/i, weight: 1.0 },
            { pattern: /local\s+cheque\s+(?:collection|credit)/i, weight: 0.95 },
            { pattern: /cheque\s+realization/i, weight: 0.9 },
        ],
    },

    CHEQUE_RETURN: {
        priority: 12,
        isTransaction: true,
        transactionType: 'cheque_return',
        direction: 'debit',
        keywords: [
            { pattern: /cheque\s+(?:returned|bounced|dishonoured|dishonored)/i, weight: 1.0 },
            { pattern: /(?:chq|cheque)\s+(?:return|bounce)/i, weight: 1.0 },
            { pattern: /insufficient\s+funds?.*cheque/i, weight: 1.0 },
            { pattern: /reason\s+for\s+return/i, weight: 0.9 },
        ],
    },

    STANDING_INSTRUCTION: {
        priority: 10,
        isTransaction: true,
        transactionType: 'standing_instruction',
        direction: 'debit',
        keywords: [
            { pattern: /standing\s+(?:instruction|order)\s+(?:executed|processed)/i, weight: 1.0 },
            { pattern: /si\s+(?:debit|transaction)/i, weight: 0.95 },
            { pattern: /scheduled\s+(?:payment|transfer)\s+(?:executed|processed)/i, weight: 0.9 },
            { pattern: /periodic\s+payment/i, weight: 0.85 },
        ],
    },

    ENACH_MANDATE: {
        priority: 11,
        isTransaction: true,
        transactionType: 'enach',
        direction: 'debit',
        keywords: [
            { pattern: /e[- ]?nach\s+(?:debit|mandate|transaction)/i, weight: 1.0 },
            { pattern: /nach\s+(?:debit|mandate|transaction)/i, weight: 1.0 },
            { pattern: /auto[- ]?(?:debit|pay)\s+(?:processed|successful)/i, weight: 0.95 },
            { pattern: /mandate.*(?:debited|executed)/i, weight: 0.9 },
            { pattern: /recurring\s+(?:debit|payment)\s+(?:processed|successful)/i, weight: 0.9 },
        ],
    },

    ATM_TRANSACTION: {
        priority: 10,
        isTransaction: true,
        transactionType: 'atm_withdrawal',
        direction: 'debit',
        keywords: [
            { pattern: /atm\s+(?:withdrawal|cash\s+withdrawal)/i, weight: 1.0 },
            { pattern: /cash\s+withdrawn\s+(?:from|at)\s+atm/i, weight: 1.0 },
            { pattern: /atm\s+txn/i, weight: 0.9 },
        ],
    },

    CASH_DEPOSIT: {
        priority: 10,
        isTransaction: true,
        transactionType: 'cash_deposit',
        direction: 'credit',
        keywords: [
            { pattern: /cash\s+(?:deposit|deposited)/i, weight: 1.0 },
            { pattern: /(?:cdm|cash\s+deposit\s+machine)/i, weight: 0.95 },
            { pattern: /self\s+deposit/i, weight: 0.9 },
        ],
    },

    SWEEP_TRANSACTION: {
        priority: 9,
        isTransaction: true,
        transactionType: 'sweep_out',
        direction: 'debit',
        keywords: [
            { pattern: /auto[- ]?sweep/i, weight: 1.0 },
            { pattern: /sweep[- ]?(?:in|out)/i, weight: 1.0 },
            { pattern: /flexi\s+(?:rd|fd)\s+(?:created|transfer)/i, weight: 0.9 },
        ],
    },

    WALLET_TRANSFER: {
        priority: 9,
        isTransaction: true,
        transactionType: 'wallet_load',
        direction: 'debit',
        keywords: [
            { pattern: /wallet\s+(?:load|top[- ]?up|recharge)/i, weight: 1.0 },
            { pattern: /added\s+to\s+(?:paytm|phonepe|amazon\s+pay)\s+wallet/i, weight: 1.0 },
            { pattern: /wallet\s+balance\s+added/i, weight: 0.9 },
        ],
    },

    // Classification-only patterns (excluded from ingestion)
    LOAN_EMI_INDICATOR: {
        priority: 5,
        isTransaction: false, // NOT a transaction - classification only
        transactionType: 'emi_installment',
        keywords: [
            { pattern: /emi\s+(?:due|payment|deducted|debited)/i, weight: 1.0 },
            { pattern: /(?:loan|home\s+loan|personal\s+loan|car\s+loan)\s+emi/i, weight: 1.0 },
            { pattern: /(?:instalment|installment)\s+(?:due|payment)/i, weight: 0.9 },
            { pattern: /loan\s+(?:repayment|disburs)/i, weight: 0.9 },
        ],
    },
};

// ============================================
// FINANCIAL AUTHORITIES (Banks, Wallets, Cards)
// The ONLY trusted sources for transactions.
// ============================================

export const FINANCIAL_AUTHORITIES: Record<string, {
    domains: string[];
    displayName: string;
    type: 'bank' | 'wallet' | 'card' | 'fintech' | 'invest' | 'crypto' | 'payment_gateway';
}> = {
    // Major Banks
    hdfc: { domains: ['hdfc', 'hdfcbank', 'alerts@hdfcbank.net'], displayName: 'HDFC Bank', type: 'bank' },
    icici: { domains: ['icici', 'icicibank'], displayName: 'ICICI Bank', type: 'bank' },
    axis: { domains: ['axis', 'axisbank', 'alerts@axis.bank.in'], displayName: 'Axis Bank', type: 'bank' },
    sbi: { domains: ['sbi', 'statebank', 'onlinesbi', 'sbicard'], displayName: 'State Bank of India', type: 'bank' },
    indusind: { domains: ['indusind', 'indusindbank'], displayName: 'IndusInd Bank', type: 'bank' },
    kotak: { domains: ['kotak', 'kotakbank', 'kotak811'], displayName: 'Kotak Mahindra Bank', type: 'bank' },
    yes: { domains: ['yesbank'], displayName: 'Yes Bank', type: 'bank' },
    bob: { domains: ['bankofbaroda', 'bob'], displayName: 'Bank of Baroda', type: 'bank' },
    pnb: { domains: ['pnb', 'pnbindia'], displayName: 'Punjab National Bank', type: 'bank' },
    canara: { domains: ['canarabank'], displayName: 'Canara Bank', type: 'bank' },
    union: { domains: ['unionbank', 'unionbankofindia'], displayName: 'Union Bank of India', type: 'bank' },
    idbi: { domains: ['idbi', 'idbibank'], displayName: 'IDBI Bank', type: 'bank' },
    hsbc: { domains: ['hsbc'], displayName: 'HSBC', type: 'bank' },
    citi: { domains: ['citi', 'citibank'], displayName: 'Citibank', type: 'bank' },
    amex: { domains: ['americanexpress', 'amex'], displayName: 'American Express', type: 'card' },
    rbl: { domains: ['rblbank'], displayName: 'RBL Bank', type: 'bank' },
    federal: { domains: ['federalbank'], displayName: 'Federal Bank', type: 'bank' },
    idfc: { domains: ['idfcfirst', 'idfc'], displayName: 'IDFC First Bank', type: 'bank' },
    au: { domains: ['aubank'], displayName: 'AU Small Finance Bank', type: 'bank' },
    csb: { domains: ['csbbank', 'csb'], displayName: 'CSB Bank', type: 'bank' },
    bandhan: { domains: ['bandhanbank'], displayName: 'Bandhan Bank', type: 'bank' },
    south_indian: { domains: ['southindianbank', 'sib'], displayName: 'South Indian Bank', type: 'bank' },
    dhanalaxmi: { domains: ['dhanbank'], displayName: 'Dhanalaxmi Bank', type: 'bank' },
    karur_vysya: { domains: ['kvb'], displayName: 'Karur Vysya Bank', type: 'bank' },
    standard_chartered: { domains: ['sc.com', 'standardchartered'], displayName: 'Standard Chartered', type: 'bank' },

    // Digital banks / Fintech
    jupiter: { domains: ['jupiter', 'jupiter.money'], displayName: 'Jupiter', type: 'fintech' },
    fi: { domains: ['fi.money', 'epifi'], displayName: 'Fi Money', type: 'fintech' },
    niyo: { domains: ['niyo', 'goniyo'], displayName: 'Niyo', type: 'fintech' },
    slice: { domains: ['slice', 'quadrillion.finance'], displayName: 'Slice', type: 'fintech' },
    cred: { domains: ['cred', 'cred.club'], displayName: 'CRED', type: 'fintech' },
    fold: { domains: ['fold'], displayName: 'Fold Money', type: 'fintech' },
    postpe: { domains: ['postpe.app', 'bharatpe'], displayName: 'PostPe', type: 'fintech' },
    navi: { domains: ['navi.com', 'navi-lending'], displayName: 'Navi', type: 'fintech' },

    // Investment / Trading
    zerodha: { domains: ['zerodha.com', 'zerodha.net'], displayName: 'Zerodha', type: 'invest' },
    dhan: { domains: ['dhan.co'], displayName: 'Dhan', type: 'invest' },
    groww: { domains: ['groww.in'], displayName: 'Groww', type: 'invest' },
    upstox: { domains: ['upstox.com', 'rksv'], displayName: 'Upstox', type: 'invest' },
    angelone: { domains: ['angelone', 'angelbroking'], displayName: 'Angel One', type: 'invest' },
    indmoney: { domains: ['indmoney'], displayName: 'INDmoney', type: 'invest' },
    smallcase: { domains: ['smallcase'], displayName: 'smallcase', type: 'invest' },
    kuvera: { domains: ['kuvera.in'], displayName: 'Kuvera', type: 'invest' },

    // Crypto
    coinbase: { domains: ['coinbase.com'], displayName: 'Coinbase', type: 'crypto' },
    binance: { domains: ['binance.com'], displayName: 'Binance', type: 'crypto' },
    bitmex: { domains: ['bitmex.com'], displayName: 'BitMEX', type: 'crypto' },
    onramp: { domains: ['onramp.money'], displayName: 'Onramp', type: 'crypto' },
    wazirx: { domains: ['wazirx.com'], displayName: 'WazirX', type: 'crypto' },
    coindcx: { domains: ['coindcx'], displayName: 'CoinDCX', type: 'crypto' },

    // Depositories & Registrars (Stock/MF Alerts)
    cdsl: { domains: ['cdslindia.co.in', 'cdslindia'], displayName: 'CDSL', type: 'invest' },
    nsdl: { domains: ['nsdl.co.in', 'nsdl.com'], displayName: 'NSDL', type: 'invest' },
    cams: { domains: ['camsonline.com', 'mycams'], displayName: 'CAMS', type: 'invest' },
    kfintech: { domains: ['kfintech.com'], displayName: 'KFintech', type: 'invest' },
    linkintime: { domains: ['linkintime.co.in'], displayName: 'Link Intime', type: 'invest' },

    // UPI/Wallets/Gateways
    gpay: { domains: ['google', 'googleplay'], displayName: 'Google Pay', type: 'wallet' },
    phonepe: { domains: ['phonepe'], displayName: 'PhonePe', type: 'wallet' },
    paytm: { domains: ['paytm'], displayName: 'Paytm', type: 'wallet' },
    amazonpay: { domains: ['amazon'], displayName: 'Amazon Pay', type: 'wallet' },
    stripe: { domains: ['stripe.com'], displayName: 'Stripe', type: 'payment_gateway' },
    razorpay: { domains: ['razorpay.com'], displayName: 'Razorpay', type: 'payment_gateway' },

    // Credit Cards
    bajaj: { domains: ['bajaj', 'bajajfinserv'], displayName: 'Bajaj Finserv', type: 'card' },
    onecard: { domains: ['onecard', 'getonecard'], displayName: 'OneCard', type: 'card' },
    uni: { domains: ['uni.cards', 'uni.orb'], displayName: 'Uni Cards', type: 'card' },
};

// Alias for backward compatibility if needed, though we should migrate
export const BANK_PATTERNS = FINANCIAL_AUTHORITIES;

// ============================================
// MERCHANTS (Explicitly Ignored to prevent duplicates)
// ============================================
export const MERCHANT_DOMAINS: Record<string, {
    domains: string[];
    displayName: string;
    category: string;
}> = {
    // Travel / Ride
    uber: { domains: ['uber.com'], displayName: 'Uber', category: 'transport' },
    ola: { domains: ['olacabs.com'], displayName: 'Ola', category: 'transport' },
    rapido: { domains: ['rapido.bike'], displayName: 'Rapido', category: 'transport' },
    blusmart: { domains: ['blusmart'], displayName: 'BluSmart', category: 'transport' },

    // Food
    swiggy: { domains: ['swiggy.in', 'swiggy.com'], displayName: 'Swiggy', category: 'food' },
    zomato: { domains: ['zomato.com'], displayName: 'Zomato', category: 'food' },
    blinkit: { domains: ['blinkit.com', 'grofers.com'], displayName: 'Blinkit', category: 'grocery' },
    zepto: { domains: ['zepto', 'zeptonow'], displayName: 'Zepto', category: 'grocery' },
    instamart: { domains: ['instamart'], displayName: 'Swiggy Instamart', category: 'grocery' },

    // Shopping
    amazon: { domains: ['amazon.in', 'amazon.com'], displayName: 'Amazon', category: 'shopping' },
    flipkart: { domains: ['flipkart.com'], displayName: 'Flipkart', category: 'shopping' },
    myntra: { domains: ['myntra.com'], displayName: 'Myntra', category: 'shopping' },
    ajio: { domains: ['ajio.com'], displayName: 'Ajio', category: 'shopping' },

    // Entertainment
    netflix: { domains: ['netflix.com', 'netflix'], displayName: 'Netflix', category: 'subscription' },
    spotify: { domains: ['spotify.com', 'spotify'], displayName: 'Spotify', category: 'subscription' },
    youtube: { domains: ['youtube.com'], displayName: 'YouTube', category: 'subscription' },
    bookmyshow: { domains: ['bookmyshow.com', 'bigtree'], displayName: 'BookMyShow', category: 'entertainment' },
};

/**
 * Check if a sender email is from a known Financial Authority
 */
export function isFinancialAuthority(senderEmail?: string): {
    isKnown: boolean;
    bankName?: string;
    type?: string;
} {
    if (!senderEmail) return { isKnown: false };

    const emailLower = senderEmail.toLowerCase();

    for (const [key, authority] of Object.entries(FINANCIAL_AUTHORITIES)) {
        if (authority.domains.some(domain => emailLower.includes(domain))) {
            return { isKnown: true, bankName: authority.displayName, type: authority.type };
        }
    }

    return { isKnown: false };
}

/**
 * Check if a sender is a known Merchant (to be ignored)
 */
export function isMerchantSender(senderEmail?: string): {
    isMerchant: boolean;
    merchantName?: string;
} {
    if (!senderEmail) return { isMerchant: false };

    const emailLower = senderEmail.toLowerCase();

    for (const [key, merchant] of Object.entries(MERCHANT_DOMAINS)) {
        if (merchant.domains.some(domain => emailLower.includes(domain))) {
            return { isMerchant: true, merchantName: merchant.displayName };
        }
    }

    return { isMerchant: false };
}

// Backward compatibility wrapper
export function isKnownBankSender(senderEmail?: string) {
    return isFinancialAuthority(senderEmail);
}
