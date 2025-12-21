/**
 * Gate 3: Spend Type Validator
 * Validates transaction is a spend (not credit, not refund)
 * 
 * Examples:
 * - "debited Rs. 500" → PASS
 * - "credited Rs. 500" → FAIL
 * - "refunded Rs. 500" → FAIL
 */
export class SpendTypeValidator {
    private readonly SPEND_VERBS = [
        /debited?/i,
        /charged?/i,
        /deducted?/i,
        /spent?/i,
        /purchase/i,
        /paid?/i,
        /used\s+(?:at|for|on)/i,
        /transaction\s+(?:of|for)/i,
        /payment\s+(?:to|for|at)/i,
        /spent\s+(?:at|on)/i,
    ];

    private readonly REFUND_KEYWORDS = [
        /refund/i,
        /reversed/i,
        /reversal/i,
        /chargeback/i,
        /credit.*back/i,
        /returned/i,
    ];

    private readonly CREDIT_KEYWORDS = [
        /credited?/i,
        /received?/i,
        /deposited?/i,
        /transferred?\s+to\s+account/i,
        /income/i,
        /salary/i,
    ];

    validate(text: string): { isValidSpend: boolean; reason?: string } {
        const lowerText = text.toLowerCase();

        // Hard reject: refunds
        for (const pattern of this.REFUND_KEYWORDS) {
            if (lowerText.match(pattern)) {
                return {
                    isValidSpend: false,
                    reason: `Refund keyword detected: "${pattern}"`,
                };
            }
        }

        // Hard reject: credits
        for (const pattern of this.CREDIT_KEYWORDS) {
            if (lowerText.match(pattern)) {
                // But allow if it's like "credited to card" vs "credited to account"
                if (!lowerText.match(/credited\s+to\s+(?:your\s+)?account/i)) {
                    // Allow "credited" in context like "credit card"
                    if (!lowerText.match(/credit\s+card/i)) {
                        return {
                            isValidSpend: false,
                            reason: `Credit keyword detected (not a spend): "${pattern}"`,
                        };
                    }
                } else {
                    return {
                        isValidSpend: false,
                        reason: `Account credit detected (not card spend): "${pattern}"`,
                    };
                }
            }
        }

        // Require spend verb
        let foundSpendVerb = false;
        for (const pattern of this.SPEND_VERBS) {
            if (lowerText.match(pattern)) {
                foundSpendVerb = true;
                break;
            }
        }

        if (!foundSpendVerb) {
            return {
                isValidSpend: false,
                reason: 'No spend verb found (debited, charged, spent, etc.)',
            };
        }

        return { isValidSpend: true };
    }
}
