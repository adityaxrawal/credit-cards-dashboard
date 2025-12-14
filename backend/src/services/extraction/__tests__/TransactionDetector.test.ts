import { TransactionDetector, BANK_PATTERNS } from '../TransactionDetector';

describe('TransactionDetector', () => {
    let detector: TransactionDetector;

    beforeEach(() => {
        detector = new TransactionDetector();
    });

    describe('Stage 1: Terminator Detection', () => {
        it('should detect hard terminators', () => {
            expect(detector.isTerminator('Query Update', 'support@hdfcbank.net', 'Your query has been registered')).toBe(true);
            expect(detector.isTerminator('OTP', 'noreply@bank.com', 'Your One Time Password is 1234')).toBe(true);
            expect(detector.isTerminator('Password Change', 'alert@bank.com', 'Your password updated successfully')).toBe(true);
        });

        it('should NOT terminate valid transactions', () => {
            expect(detector.isTerminator('Transaction Alert', 'alerts@hdfcbank.net', 'Rs 500 spent at Swiggy')).toBe(false);
        });
    });

    describe('Stage 2: Bank Identification', () => {
        it('should identify HDFC', () => {
            expect(detector.identifyBank('alerts@hdfcbank.net')).toBe('HDFC');
            expect(detector.identifyBank('instaalerts@hdfcbank.net')).toBe('HDFC');
        });

        it('should identify SBI', () => {
            expect(detector.identifyBank('customercare@sbicard.com')).toBe('SBI');
        });

        it('should identify Axis', () => {
            expect(detector.identifyBank('alerts@axisbank.com')).toBe('Axis');
        });

        it('should identify IDFC', () => {
            expect(detector.identifyBank('creditcard@idfcfirstbank.com')).toBe('IDFC');
        });

        it('should identify YES Bank', () => {
            expect(detector.identifyBank('alerts@yesbank.in')).toBe('YES');
        });

        it('should return null for unknown sender', () => {
            expect(detector.identifyBank('scammer@unknown.com')).toBeNull();
        });
    });

    describe('Stage 3 & 4: Detection & Extraction', () => {

        it('should extract HDFC transaction with high confidence', () => {
            const email = {
                subject: 'Alert: Transaction of Rs 113.00 on HDFC Bank Credit Card',
                sender: 'alerts@hdfcbank.net',
                snippet: 'Rs 113.00 spent on Credit Card ending 1234 at SWIGGY on 2025-09-17'
            };

            const result = detector.extractTransaction(
                'msg1', 'user1', email.subject, email.sender, email.snippet, Date.now()
            );

            expect(result).not.toBeNull();
            if (result) {
                expect(result.bank).toBe('HDFC');
                expect(result.amount).toBe(113.00);
                expect(result.merchant).toBe('SWIGGY');
                expect(result.cardLast4Digit).toBe('1234');
                expect(result.confidence).toBeGreaterThanOrEqual(0.95);
                expect(result.category).toBe('Food & Dining');
            }
        });

        it('should extract SBI transaction', () => {
            const email = {
                subject: 'Transaction alert',
                sender: 'sbicard@sbicard.com',
                snippet: 'Rs. 663.00 was spent on your SBI Credit Card ending 7603 at ZOMATO on 12/12/2025.'
            };

            const result = detector.extractTransaction(
                'msg2', 'user1', email.subject, email.sender, email.snippet, Date.now()
            );

            expect(result).not.toBeNull();
            if (result) {
                expect(result.bank).toBe('SBI');
                expect(result.amount).toBe(663.00);
                expect(result.merchant).toBe('ZOMATO');
                expect(result.confidence).toBeGreaterThanOrEqual(0.95);
            }
        });

        it('should reject non-transaction email (Offer)', () => {
            const email = {
                subject: 'Personal Loan Offer',
                sender: 'alerts@hdfcbank.net',
                snippet: 'Apply for a personal loan of Rs 500000 today.'
            };

            const result = detector.extractTransaction(
                'msg3', 'user1', email.subject, email.sender, email.snippet, Date.now()
            );

            // Should be null or low confidence
            // "Apply" or "loan" might be in nonTransactionKeywords
            if (result) {
                expect(result.confidence).toBeLessThan(0.6);
            } else {
                expect(result).toBeNull();
            }
        });

        it('should handle missing date by using internal date', () => {
            const now = Date.now();
            const email = {
                subject: 'Transaction Alert',
                sender: 'alerts@axisbank.com',
                snippet: 'INR 500.00 spent on Card XX1234 at UBER.'
            };

            const result = detector.extractTransaction(
                'msg4', 'user1', email.subject, email.sender, email.snippet, now
            );

            expect(result).not.toBeNull();
            if (result) {
                expect(result.date).toBe(new Date(now).toISOString().split('T')[0]);
                expect(result.amount).toBe(500);
                expect(result.merchant).toBe('UBER');
            }
        });

        it('should normalize merchant names', () => {
            expect(detector.cleanMerchant('SWIGGY F&B')).toBe('SWIGGY FB');
            expect(detector.cleanMerchant('AMAZON PAY INDIA PVT')).toBe('AMAZON PAY INDIA PVT');
        });

        it('should generate consistent fingerprint', () => {
            const fp1 = detector.generateFingerprint(100, 'TEST', '2023-01-01', '1234');
            const fp2 = detector.generateFingerprint(100, 'TEST', '2023-01-01', '1234');
            const fp3 = detector.generateFingerprint(101, 'TEST', '2023-01-01', '1234');

            expect(fp1).toBe(fp2);
            expect(fp1).not.toBe(fp3);
        });

    });
});
