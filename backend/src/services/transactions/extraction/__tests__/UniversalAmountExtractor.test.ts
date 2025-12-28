import { UniversalAmountExtractor } from '../UniversalAmountExtractor';

describe('UniversalAmountExtractor', () => {
    test('extracts standard Indian currency format', () => {
        expect(UniversalAmountExtractor.extract('Amount: 1,23,456.00')).toBe(123456.00);
        expect(UniversalAmountExtractor.extract('Paid Rs. 1,23,456')).toBe(123456);
        expect(UniversalAmountExtractor.extract('Paid ₹1,23,456')).toBe(123456);
    });

    test('extracts amounts with suffixes', () => {
        expect(UniversalAmountExtractor.extract('Total: 500/-')).toBe(500);
        expect(UniversalAmountExtractor.extract('Bill is 1,500/-')).toBe(1500);
    });

    test('extracts naked numbers with strong context', () => {
        expect(UniversalAmountExtractor.extract('debited with 5000 for purchase')).toBe(5000);
        expect(UniversalAmountExtractor.extract('credited with 10000')).toBe(10000);
    });

    test('ignores non-currency numbers in weak context', () => {
        expect(() => UniversalAmountExtractor.extract('Order 12345 confirmed')).toThrow('Amount not found');
    });
});
