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
        // TIER 1: REJECTION PATTERNS (return false immediately)
        // ============================================
        const rejectionPatterns = [
            // Marketing/Promotional
            /marketing|promotional|discount\s+(?:offer|code)|coupon|deal|sale(?!s\s(?:commission|report))/i,
            /(?:limited|exclusive|special)\s+offer/i,
            /apply\s+(?:for|now)\s+.*(?:credit|debit)\s+card/i,
            /pre[- ]?approved.*(?:loan|card|credit)/i,
            /complimentary\s+(?:card|offer)/i,

            // Security/OTP
            /otp|verification\s+code|confirm\s+your\s+(?:identity|email)|secure\s+your\s+account/i,
            /one[- ]?time\s+password/i,
            /(?:2fa|two[- ]?factor)\s+(?:code|authentication)/i,

            // Newsletters/Updates
            /newsletter|blog|news|article(?!\s+purchase)|update(?!\s+(?:in\s+your\s+account|for\s+your|balance))/i,
            /unsubscribe|email\s+preferences/i,

            // Non-financial notifications
            /meeting|appointment|event|reminder|schedule|calendar/i,
            /password\s+reset|confirm\s+email|verify\s+account|activate\s+account/i,
            /advertising|advertisement|sponsored|ad\s+campaign/i,
            /survey|feedback|review|rate\s+our|tell\s+us/i,
            /delivery\s+(?:update|status|notification)(?!.*(?:charged|debited|paid))/i,
            /bluchips|indigo\s+reward/i,
        ];

        for (const pattern of rejectionPatterns) {
            if (pattern.test(lowerText)) {
                return false;
            }
        }

        // ============================================
        // TIER 2: ACCEPTANCE PATTERNS (count matches, require >= 2)
        // ============================================
        const acceptancePatterns = [
            // Transaction verbs
            /spent|purchase[d]?|bought|charged|debited|payment|paid|deducted/i,

            // Credit events
            /salary|income|credited?|received|deposited|refund/i,

            // Transfer types
            /upi|neft|rtgs|imps|swift|withdrawal|transfer/i,

            // Financial terms
            /amount|balance|available\s+(?:balance|limit)|due\s+date|outstanding/i,
            /interest|reward\s+points?|cashback/i,

            // Instruments
            /credit\s+card|debit\s+card|bank\s+account|savings\s+a\/c|current\s+a\/c/i,
            /card\s+ending|card\s+[*x#]\d+/i,

            // Transaction indicators
            /transaction(?!\s+failed)|txn|ref(?:erence)?\s*(?:no|number|id)/i,

            // Amounts with currency
            /[₹Rs.INR]\s*[\d,]+\.?\d*/i,

            // Bank account patterns
            /(?:account|a\/c)\s*(?:no|number)?\s*[*x#]?\d+/i,

            // EMI/Subscription
            /emi|instalment|installment|subscription|recurring\s+(?:charge|payment)/i,

            // Refund/Reversal
            /refund|reversal|reversed|chargeback|dispute/i,
        ];

        let matchCount = 0;
        for (const pattern of acceptancePatterns) {
            if (pattern.test(lowerText)) {
                matchCount++;
            }
        }

        // Require at least 2 matches for confidence
        // But if we have a currency amount + transaction verb, that's strong enough
        if (matchCount >= 2) {
            return true;
        }

        // Single match with known bank sender could still be financial
        // Use the enhanced classifier for borderline cases
        if (matchCount === 1) {
            const check = EnhancedRuleClassifier.isLikelyFinancial(text);
            return check.isFinancial && check.confidence >= 0.5;
        }

        return false;
    }
}
