import { CleanEmailContent } from '../sanitize/sanitizer';
import { Patterns } from './patterns';
import { normalizeMerchant } from '../../utils/merchantNormalizer';

export interface ExtractedTransaction {
    amount: number;
    currency: string;
    merchant: string;
    transactionDate: Date;
    cardLast4?: string;
    bankHint?: string;
    channel?: 'POS' | 'ECOM' | 'UPI' | 'UNKNOWN';
}

export class SignalTransactionExtractor {
    static extract(email: CleanEmailContent): ExtractedTransaction | null {
        const text = email.cleanedBody;
        const subject = email.subject;
        const fullText = `${subject} \n ${text}`;

        // 1. Extract Amount (CRITICAL)
        const amountData = this.extractAmount(fullText);
        if (!amountData || amountData.amount <= 0) return null;

        // 2. Extract Merchant
        let merchant = this.extractMerchant(fullText);
        merchant = normalizeMerchant(merchant);

        // 3. Extract Date
        // Prefer explicit date in body, fallback to email date
        const date = this.extractDate(fullText, email.date);

        // 4. Extract Card Last 4
        const last4 = this.extractCardLast4(fullText);

        // 5. Channel Detection
        const channel = this.detectChannel(fullText);

        // 6. False Positive Checks
        if (this.isFalsePositive(fullText, amountData.amount, merchant)) {
            return null;
        }

        return {
            amount: amountData.amount,
            currency: amountData.currency,
            merchant,
            transactionDate: date,
            cardLast4: last4,
            channel
        };
    }

    private static extractAmount(text: string): { amount: number, currency: string } | null {
        // 1. Try Strict Money Pattern first
        const match = text.match(Patterns.MONEY_STRICT);
        if (match && match[1]) {
            const raw = match[1].replace(/,/g, '');
            const val = parseFloat(raw);
            if (!isNaN(val)) {
                // Simple currency detection
                const currency = text.includes('$') || text.includes('USD') ? 'USD' :
                    text.includes('EUR') ? 'EUR' :
                        text.includes('GBP') ? 'GBP' : 'INR';
                return { amount: val, currency };
            }
        }

        // Fallback: Look for any isolated number near "spent" or "debited"
        // (Omitted for safety to avoid picking up phone numbers/OTPs)
        return null;
    }

    private static extractMerchant(text: string): string {
        // Look for "at [Merchant]" or "paid to [Merchant]"
        // This is a simplified heuristic. 
        // Real implementation would need an exclusion list of common noise words.

        const atMatch = text.match(/ at\s+([^.,\n\r]+)/i);
        if (atMatch && atMatch[1]) return atMatch[1].trim();

        const toMatch = text.match(/ to\s+([^.,\n\r]+)/i);
        if (toMatch && toMatch[1]) return toMatch[1].trim();

        // Fallback?
        return 'Unknown Merchant';
    }

    private static extractDate(text: string, emailDate: Date): Date {
        // Try to find a date string in DD/MM/YY format
        const dateMatch = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
        if (dateMatch) {
            // Parse it. Warning: DD/MM vs MM/DD. We assume DD/MM for Indian context usually.
            // Or check dateParser utility.
            // For safe fallback, if parsing fails or seems way off, use emailDate.
            try {
                const day = parseInt(dateMatch[1]);
                const month = parseInt(dateMatch[2]) - 1; // JS months are 0-11
                let year = parseInt(dateMatch[3]);
                if (year < 100) year += 2000;

                const d = new Date(year, month, day);
                if (!isNaN(d.getTime())) return d;
            } catch (e) { }
        }
        return emailDate;
    }

    private static extractCardLast4(text: string): string | undefined {
        // Look for XX1234 or ending in 1234
        const match = text.match(/(?:x{2,}|\*{2,}|ending (?:in )?)(\d{4})\b/i);
        if (match) return match[1];
        return undefined;
    }

    private static detectChannel(text: string): 'POS' | 'ECOM' | 'UPI' | 'UNKNOWN' {
        const t = text.toLowerCase();
        if (t.includes('upi')) return 'UPI';
        if (t.includes('otp') || t.includes('online')) return 'ECOM'; // Proxies for online
        if (t.includes('swipe') || t.includes('pos')) return 'POS';
        return 'UNKNOWN';
    }

    private static isFalsePositive(text: string, amount: number, merchant: string): boolean {
        const t = text.toLowerCase();
        // 1. Amount matches "total due" logic? Hard to check strict equality without context, 
        // but if "total amount due" is present and NO "spent" verb, classifier should have caught it.
        // Here we double check.

        // 2. "Refund" check
        if ((t.includes('refund') || t.includes('reversed')) && !t.includes('spent')) {
            return true;
        }

        return false;
    }
}
