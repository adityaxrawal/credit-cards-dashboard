
export class SpendTypeGate {
    private static SPEND_VERBS = [
        'spent', 'debited', 'charged',
        'purchase', 'used at', 'txn of',
        'transaction of'
    ];

    private static REFUND_KEYWORDS = [
        'refund', 'reversed', 'credited to your', 'credit of'
    ];

    static check(text: string): { passed: boolean; reason?: string } {
        const lower = text.toLowerCase();

        // 1. Must have spend verb
        const hasSpendVerb = this.SPEND_VERBS.some(v => lower.includes(v));
        if (!hasSpendVerb) {
            return { passed: false, reason: 'No spend verb found' };
        }

        // 2. Must NOT have refund keywords (redundant with HardNegative but good safety)
        const hasRefund = this.REFUND_KEYWORDS.some(k => lower.includes(k));
        if (hasRefund) {
            return { passed: false, reason: 'Refund keyword detected' };
        }

        return { passed: true };
    }
}
