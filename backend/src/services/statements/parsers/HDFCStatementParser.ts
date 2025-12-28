import { IStatementParser } from './IStatementParser';
import { ExtractedStatement, StatementTransaction } from '../../../types/statement.types';

export class HDFCStatementParser implements IStatementParser {

    supports(text: string): boolean {
        return text.includes('HDFC BANK') || (text.includes('Process Date') && text.includes('Transaction Description'));
    }

    async parse(pdfDoc: any): Promise<ExtractedStatement> {
        let text = '';
        const numPages = pdfDoc.numPages;

        for (let i = 1; i <= numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const content = await page.getTextContent();

            // Simple joining strategy for now. 
            // Better strategy: sort by Y, then X. 
            // For HDFC, usually items are distinct enough.
            const pageText = content.items.map((item: any) => item.str).join(' ');
            text += pageText + '\n';
        }

        const transactions: StatementTransaction[] = [];

        // Updated Regex for loose matching on pdfjs extracted text (which might have extra spaces)
        // HDFC: 15/01/2024 Description... Amount...
        // Note: pdfjs might produce "15/01/2024 AMAZON 500.00"

        const lineRegex = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})(?:\s+(Cr))?/gi;

        let match;
        while ((match = lineRegex.exec(text)) !== null) {
            const [fullMatch, dateStr, description, amountStr, creditIndicator] = match;

            if (description.includes('Opening Balance') || description.includes('Total Dues')) {
                continue;
            }

            const amount = parseFloat(amountStr.replace(/,/g, ''));
            const [day, month, year] = dateStr.split('/').map(Number);
            const date = new Date(year, month - 1, day);

            // Validation: valid date
            if (isNaN(date.getTime())) continue;

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
