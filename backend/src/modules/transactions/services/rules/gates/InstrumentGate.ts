
export class InstrumentGate {

    static check(text: string): { passed: boolean; reason?: string } {
        // 1. Explicit Debit Card
        if (text.match(/debit\s+card/i) && !text.match(/credit\s+card/i)) {
            return { passed: false, reason: 'Debit card detected' };
        }

        // 2. Account Debit
        if (text.match(/account\s+(?:has\s+)?been\s+debited/i)) {
            return { passed: false, reason: 'Account debit detected' };
        }

        // 3. Plain UPI (unless CC context exists)
        // If it says "UPI" but NO "credit card", we reject.
        // If it says "UPI" AND "credit card", it might be RuPay CC on UPI, so we accept.
        if (text.match(/\bupi\b|upi\s+transfer/i) && !text.match(/credit\s+card|rupay/i)) {
            return { passed: false, reason: 'Plain UPI detected' };
        }

        return { passed: true };
    }
}
