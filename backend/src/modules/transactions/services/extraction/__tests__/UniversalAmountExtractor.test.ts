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

    // Fix #7
    test('extracts Indian text formats (Lakh/Crore)', () => {
        expect(UniversalAmountExtractor.extract('Loan of 2.5 Lakh approved')).toBe(250000);
        expect(UniversalAmountExtractor.extract('Salary 10.5 Lakhs credited')).toBe(1050000);
        expect(UniversalAmountExtractor.extract('Budget 1.2 Cr allocated')).toBe(12000000);
        expect(UniversalAmountExtractor.extract('Revenue ₹ 5 Crores')).toBe(50000000);
        expect(UniversalAmountExtractor.extract('Cost 1,200 Lakh')).toBe(120000000);
    });

    test('extracts naked numbers with strong context', () => {
        expect(UniversalAmountExtractor.extract('debited with 5000 for purchase')).toBe(5000);
        expect(UniversalAmountExtractor.extract('credited with 10000')).toBe(10000);
    });

    test('ignores non-currency numbers in weak context', () => {
        expect(() => UniversalAmountExtractor.extract('Order 12345 confirmed')).toThrow('Amount not found');
    });
});
