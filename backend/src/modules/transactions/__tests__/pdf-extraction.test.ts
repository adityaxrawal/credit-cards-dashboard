
import { StatementExtractor } from '../services/extraction/statement.extractor';
import { HDFCParserStrategy } from '../services/extraction/strategies/HDFCStrategy';
import { GenericParserStrategy } from '../services/extraction/strategies/GenericParserStrategy';

describe('PDF Statement Extraction', () => {
    let extractor: StatementExtractor;

    beforeEach(() => {
        extractor = new StatementExtractor();
    });

    describe('Strategy Selection', () => {
        it('should use HDFC strategy for HDFC bank', () => {
            const hdfcStrategy = new HDFCParserStrategy();
            expect(hdfcStrategy.canHandle('HDFC Bank')).toBe(true);
            expect(hdfcStrategy.canHandle('ICICI Bank')).toBe(false);
        });

        it('should fallback to Generic strategy for unknown banks', () => {
            const genericStrategy = new GenericParserStrategy();
            expect(genericStrategy.canHandle('Any Bank')).toBe(true);
        });
    });

    describe('HDFC Parsing', () => {
        it('should parse valid debit transaction', () => {
            const text = `
            25/05/2023 POS 402245XXXXXX1234 AMAZON PAY IND 500.00
            `;
            // Note: Our naive regex expects date at start. 
            // Real PDF text often has newlines.
            // HDFC parser splits by newline.

            const results = extractor.extract(text, 'HDFC Bank', '2023-01-01');

            expect(results.length).toBe(1);
            expect(results[0].amount).toBe(500.00);
            expect(results[0].date).toBe('2023-05-25');
            expect(results[0].merchant).toBe('AMAZON PAY IND'); // Cleaned merchant
            expect(results[0].bank).toBe('HDFC Bank');
        });

        it('should ignore credit transactions (if designed to)', () => {
            const text = `
            25/05/2023 NEFT CREDIT FROM GOOGLE 5000.00 Cr
            `;
            const results = extractor.extract(text, 'HDFC Bank', '2023-01-01');
            expect(results.length).toBe(0); // Should exclude credits
        });

        it('should parse line with Ref No correctly', () => {
            const text = `
             25/05/2023 UPI-PAYTM-1234567890-MERCHANT 123456 200.00
             `;
            const results = extractor.extract(text, 'HDFC Bank', '2023-01-01');
            expect(results.length).toBe(1);
            expect(results[0].amount).toBe(200.00);
            // Verify merchant extraction logic deals with UPI-
            // The implementation simplifies it.
        });
    });

    describe('Generic Parsing', () => {
        it('should parse simple line format', () => {
            const text = `
             25-05-2023 SWIGGY ORDER 123 450.00
             `;
            const results = extractor.extract(text, 'Unknown Bank', '2023-01-01');
            expect(results.length).toBe(1);
            expect(results[0].merchant).toContain('SWIGGY');
            expect(results[0].amount).toBe(450.00);
        });
    });
});
