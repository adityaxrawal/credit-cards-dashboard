import { EnhancedRuleClassifier } from '../classification/EnhancedRuleClassifier';

export class BroadFinancialDetector {
    /**
     * Determine if email represents any financial activity
     * High precision, rejects noise: marketing, OTPs, newsletters
     * 
     * Uses a two-tier approach:
     * 1. Quick rejection of known non-financial patterns
     * 2. Pattern-based acceptance with weighted scoring
     */
    static isFinancialEmail(text: string): boolean {
        const lowerText = text.toLowerCase();

        // ============================================
        // TIER 1: ACCEPTANCE PATTERNS (check FIRST to avoid false negatives)
        // Strong financial signals should bypass rejection patterns
        // ============================================
        const acceptancePatterns = [
            // Transaction verbs
            /spent|purchase[d]?|bought|charged|debited|payment|paid|deducted/i,

            // Credit events
            /salary|income|credited?|received|deposited|refund/i,

            // Transfer types
            /upi|neft|rtgs|imps|swift|withdrawal|transfer/i,

            // Financial terms with context (avoid generic usage)
            /(?:total|invoice|bill)\s+(?:amount|value)|balance\s+available|outstanding\s+(?:due|amount)|payment\s+due/i,
            /interest\s+(?:credited|charged)|cashback\s+(?:received|earned)|reward\s+points/i,

            // Instruments
            /credit\s+card|debit\s+card|bank\s+account|savings\s+a\/c|current\s+a\/c|RuPay\s+card|forex\s+card/i,
            /card\s+ending|card\s+[*x#]\d+|card\s+no\.?\s*[*x#]?\d+|ending\s+in\s+[*x#]?\d+/i,

            // Transaction indicators
            /transaction(?!\s+failed)|txn|ref(?:erence)?\s*(?:no|number|id)|payment\s+successful/i,

            // Amounts with currency
            /[₹Rs.INR]\s*[\d,]+\.?\d*/i,

            // Bank account patterns
            /(?:account|a\/c)\s*(?:no|number)?\s*[*x#]?\d+/i,

            // EMI/Subscription
            /emi|instalment|installment|subscription|recurring\s+(?:charge|payment)/i,

            // Refund/Reversal
            /refund|reversal|reversed|chargeback|dispute/i,

            // Transaction status patterns (critical for RuPay CC alerts)
            /(?:payment|transaction)\s+(?:was\s+)?(?:successful|approved|completed|processed)/i,
        ];

        let acceptanceMatchCount = 0;
        for (const pattern of acceptancePatterns) {
            if (pattern.test(lowerText)) {
                acceptanceMatchCount++;
            }
        }

        // If we have 2+ strong financial indicators, this is definitely financial
        // Skip rejection patterns to avoid false negatives from footer content
        if (acceptanceMatchCount >= 2) {
            return true;
        }

        // ============================================
        // TIER 2: REJECTION PATTERNS (only if not enough acceptance signals)
        // ============================================
        const rejectionPatterns = [
            // Marketing/Promotional
            /marketing|promotional|discount\s+(?:offer|code)|coupon|deal|sale(?!s\s(?:commission|report))/i,
            /(?:limited|exclusive|special)\s+offer/i,
            /apply\s+(?:for|now)\s+.*(?:credit|debit)\s+card/i,
            /pre[- ]?approved.*(?:loan|card|credit|limit)/i,
            /complimentary\s+(?:card|offer|membership|subscription)/i,
            /invest(?:ment|ing)?\s+(?:in|now|plan|fund|opportunity)/i,
            /mutual\s+fund|sip|portfolio|growth\s+plan|insurance\s+(?:plan|policy)/i,
            /voucher|gift\s+card|reward\s+unlocked/i,

            // Security/OTP
            /otp|verification\s+code|confirm\s+your\s+(?:identity|email)|secure\s+your\s+account/i,
            /one[- ]?time\s+password/i,
            /(?:2fa|two[- ]?factor)\s+(?:code|authentication)/i,

            // Newsletters/Updates
            /newsletter|blog|news|article(?!\s+purchase)|update(?!\s+(?:in\s+your\s+account|for\s+your|balance))/i,
            // NOTE: Removed 'unsubscribe' from rejection - appears in valid transaction email footers
            /email\s+preferences/i,

            // Non-financial notifications
            /meeting|appointment|event|reminder|schedule|calendar/i,
            /password\s+reset|confirm\s+email|verify\s+account|activate\s+account/i,
            /advertising|advertisement|sponsored|ad\s+campaign/i,
            /survey|feedback|review|rate\s+our|tell\s+us/i,
            /delivery\s+(?:update|status|notification)(?!.*(?:charged|debited|paid))/i,
            /bluchips|indigo\s+reward/i,

            // Statement/Bill Generation (Noise if no amount mentioned)
            /(?:statement|bill)\s+(?:is\s+)?(?:ready|generated|available)\s+(?:to\s+view|for)/i,
            /view\s+(?:your\s+)?(?:statement|bill|invoice)(?!.*(?:paid|charged))/i,
            /download\s+(?:your\s+)?(?:statement|bill)/i,
        ];

        // Only reject if we have 1 or fewer acceptance matches
        for (const pattern of rejectionPatterns) {
            if (pattern.test(lowerText)) {
                return false;
            }
        }

        // ============================================
        // TIER 3: BORDERLINE CASES (1 acceptance match)
        // ============================================
        if (acceptanceMatchCount === 1) {
            const check = EnhancedRuleClassifier.isLikelyFinancial(text);
            return check.isFinancial && check.confidence >= 0.5;
        }

        return false;
    }
}
