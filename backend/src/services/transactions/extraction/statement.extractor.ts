import dayjs from 'dayjs';
import * as crypto from 'crypto';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

export interface ExtractedStatementTransaction {
    amount: number;
    date: string; // YYYY-MM-DD
    merchant: string;
    description: string;
    bank: string;
    currency: 'INR';
    category: string;
    confidence: number;
    evidence: {
        rawLine: string;
    };
}

export class StatementExtractor {

    /**
     * Extract multiple transactions from a Statement Text (PDF content)
     */
    public extract(
        text: string,
        bankName: string,
        defaultDate: string
    ): ExtractedStatementTransaction[] {
        const lines = text.split('\n');
        const transactions: ExtractedStatementTransaction[] = [];

        // Simple Heuristic for Statement Lines:
        // DATE ... DESCRIPTION ... AMOUNT
        const dateStartRegex = /^(\d{1,2}[-\/\s](?:\w{3}|\d{1,2})[-\/\s]?\d{2,4})/;
        // Amount: 1,234.56 or 1234.56. (Dr/Cr suffix optional)
        const amountRegex = /([\d,]+\.\d{2})(?:\s*(?:Cr|Dr))?$/i;

        for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            const lower = cleanLine.toLowerCase();
            // EXCLUSIONS: Summaries, Balances, Rewards
            if (lower.includes('total') || lower.includes('balance') || lower.includes('opening') || lower.includes('closing') || lower.includes('payment received') || lower.includes('reward') || lower.includes('due date')) {
                continue;
            }

            // 1. Check for Date
            const dateMatch = cleanLine.match(dateStartRegex);
            if (!dateMatch) continue;

            const rawDate = dateMatch[1];
            const date = this.parseDate(rawDate);
            if (!dayjs(date).isValid()) continue;

            // 2. Check for Amount
            const amountMatch = cleanLine.match(amountRegex);
            if (!amountMatch) continue;

            // Check if explicitly Credit
            if (cleanLine.match(/[\d,]+\.\d{2}\s*Cr/i) || cleanLine.toLowerCase().includes(' cr')) {
                // Skip Credits (Payments/Refunds)
                continue;
            }

            let amount = parseFloat(amountMatch[1].replace(/,/g, ''));
            if (isNaN(amount) || amount <= 0) continue;

            // 3. Extract Description (Text between Date and Amount)
            let description = cleanLine.substring(rawDate.length).trim();

            // Remove Amount from end
            if (description.endsWith(amountMatch[0])) {
                description = description.substring(0, description.length - amountMatch[0].length).trim();
            } else {
                description = description.replace(amountMatch[0], '').trim();
            }

            // Cleanup description
            description = description.replace(/\s*(?:Cr|Dr)$/i, '').trim();
            const cleanMerchantName = this.cleanMerchant(description);

            if (cleanMerchantName.length < 3) continue;

            transactions.push({
                amount,
                date: date,
                merchant: cleanMerchantName,
                description: description,
                bank: bankName,
                currency: 'INR',
                category: this.categorizeTransaction(cleanMerchantName),
                confidence: 0.9,
                evidence: {
                    rawLine: cleanLine
                }
            });
        }

        return transactions;
    }

    private parseDate(dateStr: string): string {
        const formats = [
            'D MMM YYYY', 'DD MMM YYYY',
            'D-MMM-YYYY', 'DD-MMM-YYYY',
            'D/M/YYYY', 'DD/MM/YYYY',
            'D-M-YYYY', 'DD-MM-YYYY',
            'DD MMM' // Current year assumed?
        ];

        let parsed = dayjs(dateStr, formats, true);
        if (!parsed.isValid()) {
            parsed = dayjs(dateStr);
        }

        if (parsed.isValid()) {
            // Handle "DD MMM" without year -> assume current year implies logic, but for now strict
            // If year is missing (e.g. 2001), dayjs might default to 2001. 
            // Let's trust dayjs loose parsing if strict failed but valid.
            return parsed.format('YYYY-MM-DD');
        }
        return dateStr;
    }

    private cleanMerchant(merchant: string): string {
        return merchant
            .toUpperCase()
            .trim()
            .replace(/[^A-Z0-9\s*-]/g, '')
            .replace(/\s+/g, ' ')
            .substring(0, 100);
    }

    private categorizeTransaction(merchant: string): string {
        const m = merchant.toLowerCase();
        if (m.match(/swiggy|zomato|uber eats|food|restaurant|cafe|pizza|burger/)) return 'Food & Dining';
        if (m.match(/uber|ola|indigo|airline|flight|hotel|booking|travel|yulu/)) return 'Travel';
        if (m.match(/amazon|flipkart|myntra|meesho|shop|retail|mall/)) return 'Shopping';
        if (m.match(/netflix|prime|spotify|youtube|cred|dream/)) return 'Entertainment';
        if (m.match(/grocery|supermarket|zepto|blinkit|reliance|fresh|urban/)) return 'Groceries';
        if (m.match(/hospital|pharmacy|doctor|health|medical|clinic/)) return 'Health';
        if (m.match(/linkedin|insurance|mutual|investment|stocks/)) return 'Finance';
        return 'Shopping'; // Default
    }
}
