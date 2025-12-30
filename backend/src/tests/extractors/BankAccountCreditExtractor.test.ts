/**
 * BankAccountCreditExtractor Tests
 * Tests for bank account credit transaction extraction
 */

import { BankAccountCreditExtractor } from '../../services/transactions/extraction/extractors/BankAccountCreditExtractor';

// Mock logger
jest.mock('../../utils/infrastructure/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
}));

describe('BankAccountCreditExtractor', () => {
    let extractor: BankAccountCreditExtractor;

    beforeEach(() => {
        extractor = new BankAccountCreditExtractor();
        jest.clearAllMocks();
    });

    describe('canHandle', () => {
        it('should handle HDFC bank credit emails', () => {
            const email = {
                from: 'alerts@hdfcbank.net',
                subject: 'Amount Credited',
                body: 'Rs.50000 credited to your account',
            };

            expect(extractor.canHandle(email)).toBe(true);
        });

        it('should handle SBI credit alerts', () => {
            const email = {
                from: 'donotreply@sbi.co.in',
                subject: 'Credit Alert',
                body: 'INR 25000 has been credited to your account',
            };

            expect(extractor.canHandle(email)).toBe(true);
        });

        it('should handle ICICI credit alerts', () => {
            const email = {
                from: 'alerts@icicibank.com',
                subject: 'Account Credited',
                body: 'Your account is credited with Rs 15000',
            };

            expect(extractor.canHandle(email)).toBe(true);
        });

        it('should not handle debit alerts', () => {
            const email = {
                from: 'alerts@hdfcbank.net',
                subject: 'Amount Debited',
                body: 'Rs.5000 debited from your account',
            };

            expect(extractor.canHandle(email)).toBe(false);
        });
    });

    describe('extract', () => {
        it('should extract HDFC credit transaction', async () => {
            const email = {
                messageId: 'msg-1',
                from: 'alerts@hdfcbank.net',
                subject: 'Amount Credited',
                body: 'Dear Customer, Rs.50,000.00 has been credited to your a/c XXXXXX1234 on 15-Jan-24. Info: NEFT-ABC Corp',
            };

            const result = await extractor.extract(email);

            expect(result).toBeDefined();
            expect(result?.amount).toBe(50000);
            expect(result?.direction).toBe('credit');
        });

        it('should extract Federal Bank credit', async () => {
            const email = {
                messageId: 'msg-2',
                from: 'alerts@federalbank.co.in',
                subject: 'Credit Alert',
                body: 'Amount INR 35,000 credited to your account 1234567890 on 20-Dec-2024. Ref: IMPS/123456',
            };

            const result = await extractor.extract(email);

            expect(result).toBeDefined();
            expect(result?.amount).toBe(35000);
        });

        it('should extract NEFT credits', async () => {
            const email = {
                messageId: 'msg-3',
                from: 'alerts@axisbank.com',
                subject: 'NEFT Credit',
                body: 'INR 1,00,000.00 credited to your account ending 5678 via NEFT from XYZ Company',
            };

            const result = await extractor.extract(email);

            expect(result).toBeDefined();
            expect(result?.amount).toBe(100000);
        });

        it('should extract RTGS credits', async () => {
            const email = {
                messageId: 'msg-4',
                from: 'donotreply@kotak.com',
                subject: 'RTGS Credit',
                body: 'Rs. 5,00,000 credited through RTGS',
            };

            const result = await extractor.extract(email);

            expect(result).toBeDefined();
            expect(result?.amount).toBe(500000);
        });

        it('should handle Indian number format with lakhs', async () => {
            const email = {
                messageId: 'msg-5',
                from: 'alerts@hdfcbank.net',
                subject: 'Credit Alert',
                body: 'Rs. 1,25,000.00 credited to account',
            };

            const result = await extractor.extract(email);

            expect(result).toBeDefined();
            expect(result?.amount).toBe(125000);
        });

        it('should handle salary credits', async () => {
            const email = {
                messageId: 'msg-6',
                from: 'alerts@sbi.co.in',
                subject: 'Salary Credit',
                body: 'Your salary of Rs.75,000.00 has been credited to your account 9876543210',
            };

            const result = await extractor.extract(email);

            expect(result).toBeDefined();
            expect(result?.amount).toBe(75000);
        });

        it('should return null for unparseable emails', async () => {
            const email = {
                messageId: 'msg-7',
                from: 'alerts@hdfcbank.net',
                subject: 'Statement Available',
                body: 'Your monthly statement is ready for download',
            };

            const result = await extractor.extract(email);

            expect(result).toBeNull();
        });
    });
});
