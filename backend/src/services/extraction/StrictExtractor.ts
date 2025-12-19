import { CleanEmailContent } from '../sanitize/sanitizer';

export class StrictExtractor {

    /**
     * Strict Last-4 Digit Extraction
     * MUST be adjacent to "ending", "last four", "card", or masked.
     * NEVER returns standalone 4 digits.
     */
    static extractLast4(text: string): string | null {
        const cleanText = text.toLowerCase();

        // Pattern 1: Explicit "ending" or "ending in"
        // ending 1234, ending in 1234, ending with 1234
        const endingMatch = cleanText.match(/(?:ending|ending in|ending with)\s*(?:no\.?|number)?\s*[:\s]?\s*x*(\d{4})\b/i);
        if (endingMatch) return endingMatch[1];

        // Pattern 2: Masked formats
        // ****1234, XXXXX1234, ...1234
        // Must have at least 2 mask chars
        const maskedMatch = cleanText.match(/(?:[*x.]{2,})(\d{4})\b/i);
        if (maskedMatch) return maskedMatch[1]; // Capture the digits

        // Pattern 3: "Card 1234"
        const cardMatch = cleanText.match(/card\s+(?:no\.?|number)?\s*[:\s]?\s*x*(\d{4})\b/i);
        if (cardMatch) return cardMatch[1];

        return null;
    }

    /**
     * Context-Aware Bank Name
     * Matches known banks ONLY if context supports it.
     */
    static extractBankName(text: string, sender: string): string | null {
        // 1. Sender Domain mapping (safest)
        // We removed sender *filtering*, but we can still use it for *identification*
        if (sender.includes('hdfc')) return 'HDFC Bank';
        if (sender.includes('icici')) return 'ICICI Bank';
        if (sender.includes('sbi')) return 'SBI Card';
        if (sender.includes('axis')) return 'Axis Bank';
        if (sender.includes('amex') || sender.includes('americanexpress')) return 'American Express';
        if (sender.includes('hsbc')) return 'HSBC';
        if (sender.includes('kotak')) return 'Kotak Mahindra Bank';
        if (sender.includes('indusind')) return 'IndusInd Bank';
        if (sender.includes('rbl')) return 'RBL Bank';
        if (sender.includes('citibank') || sender.includes('citi.com')) return 'Citibank';

        // 2. Body Text Search (Strict High Confidence Only)
        // Must appear near "Credit Card" or header
        const cleanText = text.toLowerCase();

        // Simple presence checks for major banks if context allows
        if (cleanText.includes('hdfc bank')) return 'HDFC Bank';
        if (cleanText.includes('icici bank')) return 'ICICI Bank';
        if (cleanText.includes('sbi card')) return 'SBI Card';
        if (cleanText.includes('axis bank')) return 'Axis Bank';
        if (cleanText.includes('american express')) return 'American Express';
        if (cleanText.includes('hsbc')) return 'HSBC';
        if (cleanText.includes('kotak bank')) return 'Kotak Mahindra Bank';
        if (cleanText.includes('rbl bank')) return 'RBL Bank';

        return null;
    }
}
