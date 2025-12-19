/**
 * Gate 1: Hard Negatives Validator
 * Immediately rejects obvious non-spending transactions
 * 
 * Examples:
 * - "Salary credited Rs. 1,50,000" → REJECT
 * - "Refund processed Rs. 500" → REJECT
 * - "Account debited for EMI Rs. 10,000" → REJECT
 */
export class HardNegativeValidator {
    private readonly HARD_NEGATIVES = [
        // Salary/Income
        /salary\s+(?:credited|deposited)/i,
        /salary\s+credit/i,
        /payroll\s+credited/i,
        /incentive\s+(?:credited|deposited)/i,
        /bonus\s+credited/i,
        /income\s+credited/i,

        // Credit to Account
        /credited\s+to\s+(?:your\s+)?account/i,
        /amount\s+credited\s+to/i,
        /deposit.*account/i,

        // Refunds & Reversals
        /refund/i,
        /reversed/i,
        /chargeback/i,

        // Account Debits (not card)
        /account\s+(?:has\s+)?been\s+debited/i,
        /account\s+debited\s+for/i,
        /deducted\s+from\s+(?:your\s+)?account/i,
        /account\s+deduction/i,

        // EMI/Loan Payments
        /\bemi\s+deducted/i,
        /emi\s+payment/i,
        /loan\s+installment/i,
        /home\s+loan.*debit/i,

        // Bank/Account Maintenance
        /account\s+maintenance\s+fee/i,
        /annual\s+fee/i,
        /service\s+charges/i,

        // OTP/Verification
        /\botp\b/i,
        /verification\s+code/i,
        /authorization\s+code/i,

        // Balance/Limit Info
        /available\s+(?:balance|limit)/i,
        /total\s+balance/i,
        /credit\s+limit\s+(?:increased|reduced)/i,
        /limit\s+change/i,

        // Payment Notifications
        /payment\s+(?:successful|received|processed)/i,
        /bill\s+payment\s+(?:successful|received)/i,
        /payment\s+received\s+from/i,

        // Transfer Notifications
        /transfer\s+completed/i,
        /amount\s+transferred/i,
        /transfer\s+(?:to|from)\s+account/i,

        // Offers/Cashback
        /cashback/i,
        /reward\s+points/i,
        /offer\s+credited/i,
        /promotion\s+(?:credited|applied)/i,

        // Card Status Changes
        /card.*activated/i,
        /card.*issuance/i,
        /card.*delivery/i,
        /card.*blocked/i,
        /card.*status\s+change/i,
    ];

    validate(text: string): { isHardNegative: boolean; reason?: string } {
        const lowerText = text.toLowerCase();

        for (const pattern of this.HARD_NEGATIVES) {
            const match = lowerText.match(pattern);
            if (match) {
                return {
                    isHardNegative: true,
                    reason: `Hard negative matched: "${match[0]}"`,
                };
            }
        }

        return { isHardNegative: false };
    }
}
