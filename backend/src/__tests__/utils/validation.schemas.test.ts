/**
 * Validation Schemas Unit Tests
 * Tests Zod schema validation
 */

import {
    CreateTransactionSchema,
    CreateCardSchema,
    TransactionFiltersSchema,
    GmailConnectSchema,
    CreateBudgetSchema,
} from '../../utils/validation.schemas';

describe('Validation Schemas', () => {
    describe('CreateTransactionSchema', () => {
        it('should validate a valid transaction', () => {
            const validData = {
                cardId: '123e4567-e89b-12d3-a456-426614174000',
                transactionDate: '2024-01-15',
                merchant: 'Amazon',
                category: 'Shopping',
                amount: 100.50,
                transactionType: 'debit',
            };

            const result = CreateTransactionSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should reject negative amount', () => {
            const invalidData = {
                cardId: '123e4567-e89b-12d3-a456-426614174000',
                transactionDate: '2024-01-15',
                merchant: 'Amazon',
                category: 'Shopping',
                amount: -50,
                transactionType: 'debit',
            };

            const result = CreateTransactionSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should reject invalid transaction type', () => {
            const invalidData = {
                cardId: '123e4567-e89b-12d3-a456-426614174000',
                transactionDate: '2024-01-15',
                merchant: 'Amazon',
                category: 'Shopping',
                amount: 100,
                transactionType: 'invalid',
            };

            const result = CreateTransactionSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should reject invalid UUID for cardId', () => {
            const invalidData = {
                cardId: 'not-a-uuid',
                transactionDate: '2024-01-15',
                merchant: 'Amazon',
                category: 'Shopping',
                amount: 100,
                transactionType: 'debit',
            };

            const result = CreateTransactionSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });

    describe('CreateCardSchema', () => {
        it('should validate a valid card', () => {
            const validData = {
                cardName: 'My Visa Card',
                bankName: 'HDFC Bank',
                lastFour: '1234',
                billDate: 15,
                dueDate: 5,
                creditLimit: 100000,
            };

            const result = CreateCardSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should reject invalid lastFour (non-digits)', () => {
            const invalidData = {
                cardName: 'My Card',
                bankName: 'HDFC Bank',
                lastFour: 'ABCD',
                billDate: 15,
                dueDate: 5,
                creditLimit: 100000,
            };

            const result = CreateCardSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should reject billDate > 31', () => {
            const invalidData = {
                cardName: 'My Card',
                bankName: 'HDFC Bank',
                lastFour: '1234',
                billDate: 32,
                dueDate: 5,
                creditLimit: 100000,
            };

            const result = CreateCardSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });

    describe('TransactionFiltersSchema', () => {
        it('should provide defaults for pagination', () => {
            const result = TransactionFiltersSchema.parse({});

            expect(result.page).toBe(1);
            expect(result.limit).toBe(50);
        });

        it('should validate billMonth range', () => {
            const validData = { billMonth: '6' };
            const result = TransactionFiltersSchema.safeParse(validData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.billMonth).toBe(6);
            }
        });

        it('should reject billMonth > 12', () => {
            const invalidData = { billMonth: '13' };
            const result = TransactionFiltersSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });

    describe('GmailConnectSchema', () => {
        it('should require refreshToken', () => {
            const result = GmailConnectSchema.safeParse({});
            expect(result.success).toBe(false);
        });

        it('should accept valid refreshToken', () => {
            const result = GmailConnectSchema.safeParse({
                refreshToken: 'valid-refresh-token',
            });
            expect(result.success).toBe(true);
        });
    });

    describe('CreateBudgetSchema', () => {
        it('should validate valid budget', () => {
            const validData = {
                month: 12,
                year: 2024,
                amount: 50000,
            };

            const result = CreateBudgetSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should reject month > 12', () => {
            const invalidData = {
                month: 13,
                year: 2024,
                amount: 50000,
            };

            const result = CreateBudgetSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });
});
