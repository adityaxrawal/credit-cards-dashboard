import { describe, it, expect } from 'jest';
import {
    validateMLOutput,
    safeParseMLOutput,
    MLClassificationSchema
} from '../src/types/ml-schema';

describe('ML Schema Validation', () => {

    describe('validateMLOutput', () => {
        it('should accept valid transaction output', () => {
            const valid = {
                isTransaction: true,
                category: 'transaction_success',
                merchant: 'SWIGGY',
                confidence: 0.95
            };

            const result = validateMLOutput(valid);
            expect(result).not.toBeNull();
            expect(result?.isTransaction).toBe(true);
            expect(result?.merchant).toBe('SWIGGY');
        });

        it('should accept valid non-transaction output', () => {
            const valid = {
                isTransaction: false,
                category: 'otp',
                merchant: null,
                confidence: 0.9
            };

            const result = validateMLOutput(valid);
            expect(result).not.toBeNull();
            expect(result?.category).toBe('otp');
        });

        it('should reject invalid category', () => {
            const invalid = {
                isTransaction: true,
                category: 'invalid_category',
                merchant: 'TEST',
                confidence: 0.8
            };

            const result = validateMLOutput(invalid);
            expect(result).toBeNull();
        });

        it('should reject missing required field', () => {
            const invalid = {
                isTransaction: true,
                category: 'transaction_success',
                // missing merchant and confidence
            };

            const result = validateMLOutput(invalid);
            expect(result).toBeNull();
        });

        it('should reject confidence out of range', () => {
            const invalid = {
                isTransaction: true,
                category: 'transaction_success',
                merchant: 'TEST',
                confidence: 1.5  // > 1
            };

            const result = validateMLOutput(invalid);
            expect(result).toBeNull();
        });

        it('should reject extra properties (strict mode)', () => {
            const invalid = {
                isTransaction: true,
                category: 'transaction_success',
                merchant: 'TEST',
                confidence: 0.9,
                extraField: 'not allowed'
            };

            const result = validateMLOutput(invalid);
            expect(result).toBeNull();
        });
    });

    describe('safeParseMLOutput', () => {
        it('should return success=true for valid data', () => {
            const valid = {
                isTransaction: false,
                category: 'non_transaction',
                merchant: null,
                confidence: 0.0
            };

            const result = safeParseMLOutput(valid);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.category).toBe('non_transaction');
            }
        });

        it('should return success=false with error for invalid data', () => {
            const invalid = {
                isTransaction: 'yes',  // wrong type
                category: 'transaction_success',
                merchant: 'TEST',
                confidence: 0.9
            };

            const result = safeParseMLOutput(invalid);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeDefined();
            }
        });
    });

    describe('All valid categories', () => {
        const validCategories = [
            'transaction_success',
            'refund',
            'statement',
            'otp',
            'non_transaction'
        ];

        validCategories.forEach(category => {
            it(`should accept category: ${category}`, () => {
                const data = {
                    isTransaction: category === 'transaction_success' || category === 'refund',
                    category,
                    merchant: category === 'transaction_success' ? 'TEST' : null,
                    confidence: 0.8
                };

                const result = validateMLOutput(data);
                expect(result).not.toBeNull();
            });
        });
    });

    describe('Edge cases', () => {
        it('should accept confidence of exactly 0', () => {
            const data = {
                isTransaction: false,
                category: 'non_transaction',
                merchant: null,
                confidence: 0
            };

            expect(validateMLOutput(data)).not.toBeNull();
        });

        it('should accept confidence of exactly 1', () => {
            const data = {
                isTransaction: true,
                category: 'transaction_success',
                merchant: 'TEST',
                confidence: 1
            };

            expect(validateMLOutput(data)).not.toBeNull();
        });

        it('should accept empty string merchant (truthy check behavior)', () => {
            const data = {
                isTransaction: true,
                category: 'transaction_success',
                merchant: '',  // empty string is valid
                confidence: 0.5
            };

            expect(validateMLOutput(data)).not.toBeNull();
        });
    });
});
