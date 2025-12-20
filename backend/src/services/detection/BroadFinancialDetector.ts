export class BroadFinancialDetector {
    /**
     * Determine if email represents any financial activity
     * High precision, rejects noise: marketing, OTPs, newsletters
     */
    static isFinancialEmail(text: string): boolean {
        const lowerText = text.toLowerCase();

        // REJECTION PATTERNS (return false immediately)
        const rejectionPatterns = [
            /marketing|promotional|discount|offer|coupon|deal|sale(?!s\s(?:commission|report))/i,
            /otp|verification code|confirm your identity|secure your account/i,
            /newsletter|blog|news|article|update(?!\s(?:in your account|for your))/i,
            /meeting|appointment|event|reminder|schedule/i,
            /password reset|confirm email|verify account|activate account/i,
            /advertising|advertisement|sponsored|ad campaign/i,
            /survey|feedback|review|rate our|tell us/i,
        ];

        for (const pattern of rejectionPatterns) {
            if (pattern.test(lowerText)) {
                return false;
            }
        }

        // ACCEPTANCE PATTERNS (count matches, require >=2)
        const acceptancePatterns = [
            /spent|purchase|purchased|bought|charged|debited|payment|paid/i,
            /salary|income|credited?|transfer|received|added/i,
            /upi|neft|rtgs|swift|deposit|withdrawal/i,
            /amount|balance|available|due date|interest|reward|cashback/i,
            /credit card|debit card|bank account|account update|account|transaction/i,
            /refund|reversal|reversed|chargeback|dispute/i,
        ];

        let matchCount = 0;
        for (const pattern of acceptancePatterns) {
            if (pattern.test(lowerText)) {
                matchCount++;
            }
        }

        // Return true if matchCount >= 2, else false
        return matchCount >= 2;
    }
}
