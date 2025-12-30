import { describe, it, expect } from '@jest/globals';
import { BankAccountUPIDebitExtractor } from '../../services/transactions/extraction/extractors/BankAccountUPIDebitExtractor';
import { BankAccountUPICreditExtractor } from '../../services/transactions/extraction/extractors/BankAccountUPICreditExtractor';
import { createMockEmail } from '../utils/testHelpers';
import { TransactionType, TransactionDirection } from '../../types/transaction.types';

describe('UPI Extractors', () => {
    const userId = 'test-user-id';

    describe('BankAccountUPIDebitExtractor', () => {
        it('should extract UPI debit from HDFC', async () => {
            const email = createMockEmail(
                'UPI Transaction Alert',
                `Rs.500.00 has been debited from your account XXXX1234 to VPA merchant@upi.
        UPI Ref: 123456789012
        Date: 28-12-2024`,
                { from: 'alerts@hdfcbank.net' }
            );

            const result = await BankAccountUPIDebitExtractor.extract(userId, email);

            expect(result.type).toBe(TransactionType.BANK_ACCOUNT_UPI_DEBIT);
            expect(result.direction).toBe(TransactionDirection.DEBIT);
            expect(result.amount).toBe(500);
        });

        it('should extract VPA from email', async () => {
            const email = createMockEmail(
                'UPI Transaction',
                'Rs 1000 debited to swiggy@upi from your account.',
                { from: 'alerts@hdfcbank.net' }
            );

            const result = await BankAccountUPIDebitExtractor.extract(userId, email);

            expect(result.counterpartyName).toContain('swiggy');
        });

        it('should handle Google Pay format', async () => {
            const email = createMockEmail(
                'Google Pay Transaction',
                'You have sent Rs.250 to John Doe via Google Pay.',
                { from: 'noreply@google.com' }
            );

            const result = await BankAccountUPIDebitExtractor.extract(userId, email);

            expect(result.amount).toBe(250);
        });

        it('should handle PhonePe format', async () => {
            const email = createMockEmail(
                'PhonePe Transaction',
                'Payment of Rs 150 to GROCERY STORE was successful.',
                { from: 'noreply@phonepe.com' }
            );

            const result = await BankAccountUPIDebitExtractor.extract(userId, email);

            expect(result.amount).toBe(150);
        });

        it('should extract UPI reference number', async () => {
            const email = createMockEmail(
                'UPI Alert',
                `Rs.750 debited from your account.
        UPI Ref No: 435612789123`,
                { from: 'alerts@icicibank.com' }
            );

            const result = await BankAccountUPIDebitExtractor.extract(userId, email);

            expect(result.referenceNumber).toBeDefined();
        });

        it('should handle merchant transactions', async () => {
            const email = createMockEmail(
                'UPI Payment',
                'Rs.99.00 paid to Netflix India via UPI.',
                { from: 'alerts@hdfcbank.net' }
            );

            const result = await BankAccountUPIDebitExtractor.extract(userId, email);

            expect(result.amount).toBe(99);
            expect(result.merchant).toContain('Netflix');
        });
    });

    describe('BankAccountUPICreditExtractor', () => {
        it('should extract UPI credit', async () => {
            const email = createMockEmail(
                'UPI Credit Alert',
                `Rs.1000.00 has been credited to your account XXXX5678 from VPA sender@upi.
        UPI Ref: 098765432109`,
                { from: 'alerts@hdfcbank.net' }
            );

            const result = await BankAccountUPICreditExtractor.extract(userId, email);

            expect(result.type).toBe(TransactionType.BANK_ACCOUNT_UPI_CREDIT);
            expect(result.direction).toBe(TransactionDirection.CREDIT);
            expect(result.amount).toBe(1000);
        });

        it('should handle received money format', async () => {
            const email = createMockEmail(
                'Money Received',
                'You have received Rs.5000 from John Doe via UPI.',
                { from: 'noreply@google.com' }
            );

            const result = await BankAccountUPICreditExtractor.extract(userId, email);

            expect(result.amount).toBe(5000);
        });

        it('should extract sender information', async () => {
            const email = createMockEmail(
                'UPI Credit',
                'Rs.2500 credited from friend@okaxis to your account.',
                { from: 'alerts@axisbank.com' }
            );

            const result = await BankAccountUPICreditExtractor.extract(userId, email);

            expect(result.counterpartyName).toBeDefined();
        });

        it('should handle refund via UPI', async () => {
            const email = createMockEmail(
                'Refund Received',
                'Refund of Rs.299 received via UPI from AMAZON.',
                { from: 'alerts@hdfcbank.net' }
            );

            const result = await BankAccountUPICreditExtractor.extract(userId, email);

            expect(result.amount).toBe(299);
        });
    });

    describe('Edge cases', () => {
        it('should handle amounts with Indian number format', async () => {
            const email = createMockEmail(
                'UPI Transaction',
                'Rs 10,00,000 credited to your account via UPI.',
                { from: 'alerts@hdfcbank.net' }
            );

            const result = await BankAccountUPICreditExtractor.extract(userId, email);

            expect(result.amount).toBe(1000000);
        });

        it('should handle failed transaction notification (no extraction)', async () => {
            const email = createMockEmail(
                'UPI Transaction Failed',
                'Your UPI transaction of Rs.500 to merchant@upi has failed.',
                { from: 'alerts@hdfcbank.net' }
            );

            const result = await BankAccountUPIDebitExtractor.extract(userId, email);

            // Should either return empty or marked as failed
            expect(result.amount).toBeUndefined();
        });

        it('should handle pending transaction notification', async () => {
            const email = createMockEmail(
                'UPI Transaction Pending',
                'Your UPI transaction of Rs.1000 is pending.',
                { from: 'alerts@hdfcbank.net' }
            );

            const result = await BankAccountUPIDebitExtractor.extract(userId, email);

            expect(result.amount).toBeUndefined();
        });
    });
});
