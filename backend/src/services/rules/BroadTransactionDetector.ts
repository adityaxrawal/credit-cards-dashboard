// rules/BroadTransactionDetector.ts

export class BroadTransactionDetector {

    private static HARD_NEGATIVES = [
        'otp', 'one time password', 'authorization code',
        'offer', 'discount', 'cashback offer',
        'newsletter', 'advertisement'
    ];

    private static TXN_SIGNALS = [
        'transaction', 'txn', 'debited', 'credited',
        'spent', 'payment', 'purchase', 'charged'
    ];

    private static CURRENCY = /(?:₹|rs\.?|inr|\$|usd)\s*[\d,]+/i;

    static isFinancialEmail(text: string): boolean {
        const lower = text.toLowerCase();

        if (this.HARD_NEGATIVES.some(k => lower.includes(k))) {
            return false;
        }

        const hasAmount = this.CURRENCY.test(lower);
        const hasTxnWord = this.TXN_SIGNALS.some(k => lower.includes(k));

        return hasAmount && hasTxnWord;
    }
}
