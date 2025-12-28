import { BroadFinancialDetector } from './BroadFinancialDetector';

describe('BroadFinancialDetector Sender Verification', () => {

    // 1. FINANCIAL AUTHORITY
    test('Should boost score for Known Financial Authority', () => {
        const text = "Your account XX1234 has been debited by INR 500.00";
        const sender = "alerts@hdfcbank.net"; // Known HDFC

        const result = BroadFinancialDetector.detect(text, sender);

        expect(result.score).toBeGreaterThanOrEqual(50);
        expect(result.isFinancial).toBe(true);
        expect(result.reasons).toContain('Verified Authority: HDFC Bank');
    });

    // 2. MERCHANT REJECTION
    test('Should reject Known Merchant', () => {
        const text = "Your Swiggy order #12345 of INR 500.00 is confirmed";
        const sender = "no-reply@swiggy.in"; // Known Swiggy

        const result = BroadFinancialDetector.detect(text, sender);

        expect(result.isFinancial).toBe(false);
        expect(result.score).toBe(0);
        expect(result.reasons).toContain('Merchant Rejection: Swiggy');
    });

    // 3. UNKNOWN SENDER PENALTY
    test('Should penalize Unknown Sender', () => {
        // A generic email that *looks* financial but is from unknown sender
        const text = "You paid INR 500.00 to someone";
        const sender = "aditya@random.com";

        const result = BroadFinancialDetector.detect(text, sender);

        // Base points: Amount(30) + Verb(20) = 50. 
        // Penalty: -20 + Unknown(-20?) -> wait, Unknown Penalty is -20.
        // So 50 - 20 = 30. Should FAIL.

        expect(result.reasons).toContain('Unknown Sender Penalty');
        expect(result.score).toBeLessThan(50);
        expect(result.isFinancial).toBe(false);
    });

    // 4. BANK NOISE FILTERING
    test('Should still filter Loan Offers from Banks', () => {
        const text = "Congratulations! You are eligible for a Pre-Approved Loan of INR 5,00,000. Apply Now.";
        const sender = "alerts@hdfcbank.net";

        const result = BroadFinancialDetector.detect(text, sender);

        // Bank Boost: +40
        // Amount: +30
        // Negative Signal (Pre-Approved/Apply Now): -50
        // Result: 70 - 50 = 20. Should FAIL.

        expect(result.isFinancial).toBe(false);
        expect(result.reasons).toContain('Negative Signal Detected');
        expect(result.reasons).toContain('Verified Authority: HDFC Bank');
    });

    // 5. INVESTMENT APPS (Zerodha, Dhan)
    test('Should boost score for Investment Apps', () => {
        const text = "Buy order executed for TCS. 10 QTY at INR 3400.00";
        const sender = "statements@dhan.co"; // New Authority

        const result = BroadFinancialDetector.detect(text, sender);

        expect(result.isFinancial).toBe(true);
        expect(result.reasons).toContain('Verified Authority: Dhan');
    });

    // 6. FINTECH APPS (Slice, PostPe)
    test('Should boost score for Fintech Apps', () => {
        const text = "Bill generated for your Slice card. Total Due: INR 5000.00";
        const sender = "alerts@sliceit.com"; // New Authority

        const result = BroadFinancialDetector.detect(text, sender);

        expect(result.isFinancial).toBe(true);
        expect(result.reasons).toContain('Verified Authority: Slice');
    });

    // 7. CRYPTO & GLOBAL (Coinbase, Stripe)
    test('Should boost score for Crypto and Global Payments', () => {
        const text = "You received 0.01 BTC";
        const sender = "no-reply@coinbase.com"; // New Authority

        const result = BroadFinancialDetector.detect(text, sender);

        expect(result.isFinancial).toBe(true);
        expect(result.reasons).toContain('Verified Authority: Coinbase');
    });
});
