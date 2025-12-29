import { describe, it, expect } from '@jest/globals';
import { EdgeCaseHandler } from '../services/transactions/extraction/EdgeCaseHandler';

describe('EdgeCaseHandler', () => {
    describe('parseAmount', () => {
        it('should parse standard INR amount', () => {
            const result = EdgeCaseHandler.parseAmount('Rs. 1,500.00 debited');
            expect(result?.amount).toBe(1500);
            expect(result?.currency).toBe('INR');
        });

        it('should parse amount with ₹ symbol', () => {
            const result = EdgeCaseHandler.parseAmount('Amount: ₹25,000');
            expect(result?.amount).toBe(25000);
        });

        it('should parse Indian format with lakhs', () => {
            const result = EdgeCaseHandler.parseAmount('Amount of 2.5 Lakhs transferred');
            expect(result?.amount).toBe(250000);
        });

        it('should parse amount with crores', () => {
            const result = EdgeCaseHandler.parseAmount('1 Crore received');
            expect(result?.amount).toBe(10000000);
        });

        it('should parse foreign currency', () => {
            const result = EdgeCaseHandler.parseAmount('USD 100.00 charged');
            expect(result?.amount).toBe(100);
            expect(result?.currency).toBe('USD');
            expect(result?.isForeignCurrency).toBe(true);
        });
    });

    describe('extractFxRate', () => {
        it('should extract conversion rate', () => {
            const result = EdgeCaseHandler.extractFxRate('Conversion rate: 83.50');
            expect(result?.rate).toBe(83.5);
        });

        it('should extract rate with currencies', () => {
            const result = EdgeCaseHandler.extractFxRate('1 USD = 83.25 INR');
            expect(result?.rate).toBe(83.25);
            expect(result?.fromCurrency).toBe('USD');
            expect(result?.toCurrency).toBe('INR');
        });
    });

    describe('isNegativeVsReversal', () => {
        it('should detect reversal from text', () => {
            const result = EdgeCaseHandler.isNegativeVsReversal(500, 'Transaction reversed');
            expect(result.isReversal).toBe(true);
            expect(result.direction).toBe('credit');
        });

        it('should detect refund', () => {
            const result = EdgeCaseHandler.isNegativeVsReversal(1000, 'Refund of Rs 1000 processed');
            expect(result.isReversal).toBe(true);
        });

        it('should detect credit from text', () => {
            const result = EdgeCaseHandler.isNegativeVsReversal(5000, 'Amount credited to your account');
            expect(result.direction).toBe('credit');
            expect(result.isReversal).toBe(false);
        });

        it('should default to debit', () => {
            const result = EdgeCaseHandler.isNegativeVsReversal(100, 'Transaction processed');
            expect(result.direction).toBe('debit');
        });
    });

    describe('handleTruncatedEmail', () => {
        it('should detect truncated email', () => {
            const result = EdgeCaseHandler.handleTruncatedEmail(
                'Transaction Alert',
                'Your account has been debited[...]',
                'debited with Rs 500'
            );
            expect(result.isTruncated).toBe(true);
        });
    });
});
