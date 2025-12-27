const pdf = require('pdf-parse');
import { IStatementParser } from './IStatementParser';
import { ExtractedStatement, StatementTransaction } from '../../../types/statement.types';

export class HDFCStatementParser implements IStatementParser {

    supports(text: string): boolean {
        return text.includes('HDFC BANK') || text.includes('Process Date') && text.includes('Transaction Description');
    }

    async parse(buffer: Buffer): Promise<ExtractedStatement> {
        const data = await pdf(buffer);
        const text = data.text;

        const transactions: StatementTransaction[] = [];

        // Regex for HDFC Credit Card Statement Line
        // Example: 15/01/2024 AMAZON PAY INDIA PRIVATE 500.00
        // Sometimes usually: Date Description Amount Cr/Dr(optional or implied)
        // Adjusting regex to be flexible

        // Pattern: Date (dd/mm/yyyy) followed by space, then Description, then Amount (with commas/dots), then 'Cr' optional
        const lineRegex = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})(?:\s+(Cr))?/gi;

        let match;
        while ((match = lineRegex.exec(text)) !== null) {
            const [fullMatch, dateStr, description, amountStr, creditIndicator] = match;

            // Basic filter: skip lines that look like headers or summaries if they accidentally match
            if (description.includes('Opening Balance') || description.includes('Total Dues')) {
                continue;
            }

            const amount = parseFloat(amountStr.replace(/,/g, ''));
            const [day, month, year] = dateStr.split('/').map(Number);
            const date = new Date(year, month - 1, day);

            // If line ends with 'Cr', it's a credit (payment/refund). Otherwise typically debit in CC statements.
            // HDFC statements often explicitly mark credits with 'Cr'.
            const type = creditIndicator === 'Cr' ? 'credit' : 'debit';

            transactions.push({
                date,
                description: description.trim(),
                amount,
                type,
                metadata: {
                    originalText: fullMatch.trim()
                }
            });
        }

        return {
            bankName: 'HDFC Bank',
            transactions,
            rawText: text
        };
    }
}
