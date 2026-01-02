import { describe, it, expect } from '@jest/globals';
import { CreditCardSpendExtractor } from '@modules/transactions/services/extraction/extractors/CreditCardSpendExtractor';
import { createMockEmail } from '../utils/testHelpers';
import { TransactionType, TransactionDirection } from '@shared/types/transaction.types';

describe('CreditCardSpendExtractor', () => {
    const userId = 'test-user-id';

    describe('HDFC Bank patterns', () => {
        it('should extract transaction from HDFC alert', async () => {
            const email = createMockEmail(
                'Transaction Alert from HDFC Bank',
                `Dear Customer,
        Your HDFC Bank Credit Card ending 1234 has been used for Rs.2500.00 at AMAZON on 28-Dec-24.
        Avl Bal: Rs.97500.00
        If you did not authorize this transaction, please call 18002586161.`,
                { from: 'alerts@hdfcbank.net' }
            );

            const result = await CreditCardSpendExtractor.extract(userId, email);

            expect(result.type).toBe(TransactionType.CREDIT_CARD_SPEND);
            expect(result.direction).toBe(TransactionDirection.DEBIT);
            expect(result.amount).toBe(2500);
            expect(result.instrumentDetails?.cardLast4).toBe('1234');
        });

        it('should extract transaction with rupee symbol', async () => {
            const email = createMockEmail(
                'Credit Card Transaction',
                'Your HDFC Credit Card XX1234 has been used for ₹1,500.00 at SWIGGY.',
                { from: 'alerts@hdfcbank.net' }
            );

            const result = await CreditCardSpendExtractor.extract(userId, email);

            expect(result.amount).toBe(1500);
        });
    });

    describe('ICICI Bank patterns', () => {
        it('should extract transaction from ICICI alert', async () => {
            const email = createMockEmail(
                'ICICI Bank Credit Card Alert',
                `Your ICICI Bank Credit Card XX5678 has been used for a purchase of INR 3,999.00 at FLIPKART.
        If not done by you, call 18001020.`,
                { from: 'alerts@icicibank.com' }
            );

            const result = await CreditCardSpendExtractor.extract(userId, email);

            expect(result.type).toBe(TransactionType.CREDIT_CARD_SPEND);
            expect(result.amount).toBe(3999);
            expect(result.instrumentDetails?.cardLast4).toBe('5678');
        });
    });

    describe('SBI Card patterns', () => {
        it('should extract transaction from SBI alert', async () => {
            const email = createMockEmail(
                'SBI Card Transaction Alert',
                `Dear Customer, Your SBI Card ending 9012 has been used for Rs 1500.00 at PVR CINEMAS.
        If not authorized by you, call 1860 180 1290.`,
                { from: 'support@sbicard.com' }
            );

            const result = await CreditCardSpendExtractor.extract(userId, email);

            expect(result.type).toBe(TransactionType.CREDIT_CARD_SPEND);
            expect(result.amount).toBe(1500);
            expect(result.instrumentDetails?.cardLast4).toBe('9012');
        });

        it('should handle CASHBACK SBI Card', async () => {
            const email = createMockEmail(
                'Transaction Alert from CASHBACK SBI Card',
                'Your CASHBACK SBI Card XX3456 has been used for INR 750.00 at DOMINOS.',
                { from: 'support@sbicard.com' }
            );

            const result = await CreditCardSpendExtractor.extract(userId, email);

            expect(result.amount).toBe(750);
        });
    });

    describe('Axis Bank patterns', () => {
        it('should extract transaction from Axis alert', async () => {
            const email = createMockEmail(
                'Axis Bank Credit Card Alert',
                'Your Axis Bank Credit Card XX4567 has been used for Rs 2,000.00 at MYNTRA.',
                { from: 'alerts@axisbank.com' }
            );

            const result = await CreditCardSpendExtractor.extract(userId, email);

            expect(result.type).toBe(TransactionType.CREDIT_CARD_SPEND);
            expect(result.amount).toBe(2000);
        });
    });

    describe('International transactions', () => {
        it('should extract USD transaction', async () => {
            const email = createMockEmail(
                'International Transaction Alert',
                `Your credit card XX1234 has been used for USD 49.99 at SPOTIFY.
        INR equivalent: Rs 4199.00`,
                { from: 'alerts@hdfcbank.net' }
            );

            const result = await CreditCardSpendExtractor.extract(userId, email);

            // Should capture the INR amount for domestic tracking
            expect(result.type).toBe(TransactionType.CREDIT_CARD_SPEND);
        });
    });

    describe('Edge cases', () => {
        it('should handle amounts without comma', async () => {
            const email = createMockEmail(
                'Transaction Alert',
                'Your card XX1234 used for Rs.500 at UBER.',
                { from: 'alerts@hdfcbank.net' }
            );

            const result = await CreditCardSpendExtractor.extract(userId, email);

            expect(result.amount).toBe(500);
        });

        it('should handle amounts with paise/cents', async () => {
            const email = createMockEmail(
                'Transaction Alert',
                'Your card XX1234 used for Rs 199.99 at NETFLIX.',
                { from: 'alerts@hdfcbank.net' }
            );

            const result = await CreditCardSpendExtractor.extract(userId, email);

            expect(result.amount).toBe(199.99);
        });

        it('should handle large amounts', async () => {
            const email = createMockEmail(
                'Transaction Alert',
                'Your card XX1234 used for Rs 1,25,000.00 at CROMA.',
                { from: 'alerts@hdfcbank.net' }
            );

            const result = await CreditCardSpendExtractor.extract(userId, email);

            expect(result.amount).toBe(125000);
        });

        it('should return empty result for non-transaction emails', async () => {
            const email = createMockEmail(
                'Credit Card Statement',
                'Your credit card statement for December is attached.',
                { from: 'statements@hdfcbank.net' }
            );

            const result = await CreditCardSpendExtractor.extract(userId, email);

            expect(result.amount).toBeUndefined();
        });
    });
});
