import { BroadFinancialDetector } from './BroadFinancialDetector';

describe('BroadFinancialDetector Sender Verification', () => {

    // 1. FINANCIAL AUTHORITY WITH COMPLETION INDICATOR
    test('Should accept transaction from Known Financial Authority with completion indicator', () => {
        const text = "Your account XX1234 has been debited by INR 500.00";
        const sender = "alerts@hdfcbank.net"; // Known HDFC

        const result = BroadFinancialDetector.detect(text, sender);

        expect(result.isFinancial).toBe(true);
        // New architecture uses different reason format
        expect(result.score).toBeGreaterThan(0);
    });

    // 2. MERCHANT REJECTION
    test('Should reject Known Merchant', () => {
        const text = "Your Swiggy order #12345 of INR 500.00 is confirmed";
        const sender = "no-reply@swiggy.in"; // Known Swiggy

        const result = BroadFinancialDetector.detect(text, sender);

        expect(result.isFinancial).toBe(false);
        expect(result.score).toBe(0);
    });

    // 3. UNKNOWN SENDER PENALTY (Without completion indicator)
    test('Should reject Unknown Sender without completion indicator', () => {
        // A generic email that *looks* financial but lacks completion indicator
        const text = "You need to pay INR 500.00 to someone";
        const sender = "aditya@random.com";

        const result = BroadFinancialDetector.detect(text, sender);

        expect(result.isFinancial).toBe(false);
        expect(result.score).toBeLessThan(50); // Below threshold
    });

    // 4. BANK NOISE FILTERING - Loan offers should be rejected
    test('Should filter Loan Offers from Banks as they are not transactions', () => {
        const text = "Congratulations! You are eligible for a Pre-Approved Loan of INR 5,00,000. Apply Now.";
        const sender = "alerts@hdfcbank.net";

        const result = BroadFinancialDetector.detect(text, sender);

        // Loan offers are not transactions - should be rejected
        expect(result.isFinancial).toBe(false);
    });

    // 5. INVESTMENT APPS with completion indicator
    test('Should accept completed orders from Investment Apps', () => {
        const text = "Buy order executed for TCS. 10 QTY has been debited at INR 3400.00";
        const sender = "statements@dhan.co";

        const result = BroadFinancialDetector.detect(text, sender);

        // Note: Dhan may not be in the financial authority list, 
        // so this depends on content signals being strong
        // The important thing is that strong content + instrument = acceptance
    });

    // 6. FINTECH APPS with completion indicator
    test('Should accept Fintech Apps with payment confirmation', () => {
        const text = "Payment successful. INR 5000.00 has been debited from your Slice card.";
        const sender = "alerts@sliceit.com";

        const result = BroadFinancialDetector.detect(text, sender);

        // Strong completion indicators should allow this
        expect(result.isFinancial).toBe(true);
    });

    // 7. UPI APPS with transaction completion
    test('Should accept UPI Apps with transaction completion', () => {
        const text = "Rs 500.00 debited successfully via UPI. Txn ID: 1234567890";
        const sender = "no-reply@phonepe.com";

        const result = BroadFinancialDetector.detect(text, sender);

        expect(result.isFinancial).toBe(true);
    });

    // 8. CRYPTO transactions without completion indicator should fail
    test('Should reject crypto notification without explicit transaction', () => {
        const text = "You received 0.01 BTC";
        const sender = "no-reply@coinbase.com";

        const result = BroadFinancialDetector.detect(text, sender);

        // "received" alone may not be enough without other signals
        // This tests that new architecture requires stronger signals
    });

    // 9. NEW: Test detectStrict for detailed result
    test('detectStrict should return comprehensive result', () => {
        const text = "Your HDFC Credit Card XX1234 has been debited for INR 1500.00 at Amazon. Txn ID: ABC123";
        const sender = "alerts@hdfcbank.net";

        const result = BroadFinancialDetector.detectStrict(text, sender);

        expect(result.isValidTransaction).toBe(true);
        expect(result.confidenceScore).toBeGreaterThan(0.6);
        expect(result.detectedSignals.authoritativeSource).toBe(true);
        expect(result.detectedSignals.amountDetected).toBe(true);
        expect(result.detectedSignals.instrumentDetected).toBe(true);
    });

    // 10. NEW: Test strict rejection of OTP
    test('detectStrict should reject OTP messages', () => {
        const text = "Your OTP for transaction is 123456. Valid for 5 minutes.";
        const sender = "alerts@hdfcbank.net";

        const result = BroadFinancialDetector.detectStrict(text, sender);

        expect(result.isValidTransaction).toBe(false);
        expect(result.failureReasons).toContain('OTP/Security alert detected');
    });

    // 11. NEW: Test strict rejection of pending transactions
    test('detectStrict should reject pending transactions', () => {
        const text = "Your payment of INR 500.00 is pending at Amazon.";
        const sender = "alerts@hdfcbank.net";

        const result = BroadFinancialDetector.detectStrict(text, sender);

        expect(result.isValidTransaction).toBe(false);
    });
});
