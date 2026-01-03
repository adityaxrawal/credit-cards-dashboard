
import { NumberParser } from '../NumberParser';

describe('NumberParser', () => {
    describe('parseAmount', () => {
        it('should parse simple numbers', () => {
            expect(NumberParser.parseAmount('100')).toBe(100);
            expect(NumberParser.parseAmount('100.50')).toBe(100.50);
        });

        it('should parse numbers with commas', () => {
            expect(NumberParser.parseAmount('1,234.50')).toBe(1234.50);
            expect(NumberParser.parseAmount('1,23,456.00')).toBe(123456.00); // Indian format
        });

        it('should parse numbers with currency symbols', () => {
            expect(NumberParser.parseAmount('₹ 500')).toBe(500);
            expect(NumberParser.parseAmount('Rs. 1,000')).toBe(1000);
            expect(NumberParser.parseAmount('INR 250.00')).toBe(250);
        });

        it('should parse Lakhs', () => {
            expect(NumberParser.parseAmount('1 Lakh')).toBe(100000);
            expect(NumberParser.parseAmount('1.5 Lakhs')).toBe(150000);
            expect(NumberParser.parseAmount('10.25 L')).toBe(1025000);
            expect(NumberParser.parseAmount('₹ 2.5 Lakh')).toBe(250000);
        });

        it('should parse Crores', () => {
            expect(NumberParser.parseAmount('1 Crore')).toBe(10000000);
            expect(NumberParser.parseAmount('1.5 Cr')).toBe(15000000);
            expect(NumberParser.parseAmount('2.12 Crores')).toBe(21200000);
        });

        it('should return null for invalid input', () => {
            expect(NumberParser.parseAmount('')).toBe(null);
            expect(NumberParser.parseAmount('abc')).toBe(null);
        });
    });
});
