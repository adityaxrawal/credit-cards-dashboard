
export class HardNegativeGate {
    private static HARD_NEGATIVES = [
        /salary\s+(?:credited|deposited|transfer)/i,
        /refund|reversed|chargeback|voided/i,
        /account\s+(?:has\s+)?been\s+debited/i,
        /\botp\b|verification\s+code/i,
        /\bemi\s+deducted/i,
        /total\s+amount\s+due/i,
        /available\s+limit/i,
        /available\s+balance/i,
        /payment\s+successful/i, // Usually bill payments
        /payment\s+received/i,
        /added\s+to\s+your\s+account/i,
        /credited\s+to\s+your\s+account/i
    ];

    static check(text: string): { passed: boolean; reason?: string } {
        for (const pattern of this.HARD_NEGATIVES) {
            if (pattern.test(text)) {
                return {
                    passed: false,
                    reason: `Hard negative match: ${pattern}`
                };
            }
        }
        return { passed: true };
    }
}
