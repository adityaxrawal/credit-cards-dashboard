
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { StatementParserStrategy } from './StatementParserStrategy';
import { ExtractedStatementTransaction } from '../statement.extractor';

dayjs.extend(customParseFormat);

export class HDFCParserStrategy implements StatementParserStrategy {
    public name = 'HDFC';

    public canHandle(bankName: string): boolean {
        return bankName.toUpperCase().includes('HDFC');
    }

    public parse(text: string, defaultDate: string): ExtractedStatementTransaction[] {
        const lines = text.split('\n');
        const transactions: ExtractedStatementTransaction[] = [];

        // HDFC Layout Heuristics:
        // Date | Description | Ref No | Debit | Credit | Balance (Variable specific order)
        // Common Format: DD/MM/YYYY Description ... Amount ... CR/DR

        // HDFC Specific Regex for Date: DD/MM/YYYY
        const dateRegex = /^(\d{2}\/\d{2}\/\d{4})/;

        // HDFC often puts "Cr" next to credit amounts like "10,000.00 Cr"
        // And debits are just "200.00"

        // HDFC Statement Line Pattern (Simplified):
        // 01/01/2023  UPI-PAYTM-...  123456...  500.00

        for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            // Skip Header/Footer noise
            if (cleanLine.match(/Date.*Transaction.*Description/i) || cleanLine.includes('Opening Balance') || cleanLine.includes('Closing Balance')) {
                continue;
            }

            const dateMatch = cleanLine.match(dateRegex);
            if (!dateMatch) continue;

            const dateStr = dateMatch[1]; // DD/MM/YYYY
            const date = dayjs(dateStr, 'DD/MM/YYYY', true);

            if (!date.isValid()) continue;

            // Extract Amounts
            // Look for numbers at the end of the line
            // Matches: 1,234.00 or 1,234.00 Cr
            const amountMatches = cleanLine.match(/([\d,]+\.\d{2})(\s*Cr)?/gi);

            if (!amountMatches || amountMatches.length === 0) continue;

            // Usually the last amount is Balance, second to last could be Credit/Debit
            // Or if only one amount, it's the transaction amount
            // HDFC Layout: [Date] [Desc] [Ref] [Debit] [Credit] [Balance]
            // If it's a debit line: [Date] [Desc] [Ref] [Debit] [Balance]
            // If it's a credit line: [Date] [Desc] [Ref] [Credit] [Balance]

            // Heuristic: If there are 2 amounts, first is Txn, second is Balance
            // If there are 3 amounts (rare in standard statement pdf text extraction due to spacing), pick the one that fits logic

            // Let's assume the FIRST extracted amount is the Transaction Amount for now (safest for simple formats)
            // But wait, if text extraction causes columns to merge, we need to be careful.

            // Better Heuristic: 
            // 1. Identify valid amounts.
            // 2. Identify if "Cr" is present.

            let amountStr = amountMatches[0];
            let isCredit = false;

            if (amountMatches.length > 1) {
                // First match is likely the transaction amount
                amountStr = amountMatches[0];
            }

            // Check for Credit suffix specifically on the amount logic or line logic
            if (amountStr.toLowerCase().includes('cr') || line.toLowerCase().includes(amountStr.toLowerCase() + ' cr')) {
                isCredit = true;
            }

            // Exclude Credits (Payments/Refunds/Salary handled by Email usually, but Statements complement this)
            // For now, let's keep DEBITS as primary focus for PDF to fill gaps
            if (isCredit) continue;

            const amount = parseFloat(amountStr.replace(/[^0-9.]/g, ''));
            if (isNaN(amount) || amount <= 0) continue;

            // Extract Description
            // Everything between Date and Amount
            // HDFC Description often starts after Date and ends before Reference No or Amount

            let description = cleanLine.substring(10).trim(); // Skip date

            // Remove the amounts from description if they accidentally got included
            const amountIndex = description.indexOf(amountStr.split(' ')[0]); // Match number part
            if (amountIndex > 0) {
                description = description.substring(0, amountIndex).trim();
            }

            // Clean up Ref No (often long number at end of desc)
            // HDFC: "UPI-PAYTM-1234567890 123456" -> description "UPI-PAYTM-1234567890", Ref "123456"
            // Simple approach: Take consistent non-numeric prefix or just keep full string

            transactions.push({
                amount,
                date: date.format('YYYY-MM-DD'),
                merchant: this.cleanMerchant(description),
                description: description,
                bank: 'HDFC',
                currency: 'INR',
                category: 'Uncategorized', // Will be enriched later
                confidence: 0.95, // Higher confidence for specific strategy
                evidence: {
                    rawLine: cleanLine
                }
            });
        }

        return transactions;
    }

    private cleanMerchant(desc: string): string {
        // HDFC: "POS 402245XXXXXX1234 AMAZON PAY IND" -> "AMAZON PAY IND"
        // HDFC: "UPI-PAYTM-123...-MERCHANT" -> "MERCHANT"

        let m = desc;

        // Remove common prefixes
        m = m.replace(/^(?:POS|ATW|NWD|EAW|OT|UPI|IPS|MMT|IRCTC)\s+[\dX]+\s*/i, '');
        m = m.replace(/^UPI-.*?-/i, ''); // UPI-HANDLE-MERCHANT -> MERCHANT (Simplified)

        return m.replace(/[^a-zA-Z0-9\s]/g, '').trim().toUpperCase();
    }
}
