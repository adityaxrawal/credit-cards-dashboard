
import { CurrencyAmountExtractor } from '../CurrencyAmountExtractor';

describe('CurrencyAmountExtractor', () => {
    test('extracts Indian text formats (Lakh/Crore) with correct multiplier', () => {
        // 2.5 Lakh = 250,000
        const res1 = CurrencyAmountExtractor.extract('Total cost is 2.5 Lakh');
        expect(res1.normalizedAmount).toBe(250000);
        expect(res1.rawAmountString).toContain('2.5 Lakh');

        // 1.5 Cr = 15,000,000
        const res2 = CurrencyAmountExtractor.extract('Project value: 1.5 Cr');
        expect(res2.normalizedAmount).toBe(15000000);

        // 10 Lakhs = 1,000,000
        const res3 = CurrencyAmountExtractor.extract('Salary: 10 Lakhs');
        expect(res3.normalizedAmount).toBe(1000000);

        // ₹ 5 Crores = 50,000,000
        const res4 = CurrencyAmountExtractor.extract('Revenue: ₹ 5 Crores');
        expect(res4.normalizedAmount).toBe(50000000);
        expect(res4.detectedCurrency).toBe('INR'); // Symbol ₹ triggers INR detection
    });

    test('extracts standard formats correctly still', () => {
        const res = CurrencyAmountExtractor.extract('Payment of $100.00');
        expect(res.normalizedAmount).toBe(100);
        expect(res.detectedCurrency).toBe('USD');

        const res2 = CurrencyAmountExtractor.extract('Payment of ₹1,234.50');
        expect(res2.normalizedAmount).toBe(1234.50);
        expect(res2.detectedCurrency).toBe('INR');
    });
});
