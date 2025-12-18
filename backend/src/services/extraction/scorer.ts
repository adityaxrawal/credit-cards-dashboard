import { CleanEmailContent } from '../sanitize/sanitizer';
import { ExtractedTransaction } from './extractor';
import { Patterns } from './patterns';

export interface ConfidenceResult {
    score: number;
    status: 'ACCEPT' | 'REVIEW' | 'DISCARD';
    reasons: string[];
}

export class ConfidenceScorer {
    static score(transaction: ExtractedTransaction, email: CleanEmailContent): ConfidenceResult {
        let score = 0;
        const reasons: string[] = [];
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();

        // 1. Amount + Debit Verb (+0.4)
        // We know amount is present if we are here (Extractor checks it).
        // But does it look like a spend?
        const hasDebitVerb = Patterns.TRANSACTION_VERBS.some(v => text.includes(v));
        if (transaction.amount > 0 && hasDebitVerb) {
            score += 0.4;
            reasons.push('Amount + Debit Verb found');
        } else if (transaction.amount > 0) {
            // Amount found but no strong verb? (Maybe just "Transaction Alert" title)
            score += 0.2;
            reasons.push('Amount found (weak verb)');
        }

        // 2. Merchant Present (+0.2)
        if (transaction.merchant && transaction.merchant !== 'Unknown Merchant') {
            score += 0.2;
            reasons.push('Merchant identified');
        }

        // 3. Date Present (+0.2)
        // Extractor defaults to email date, but if we found a DATE string in text, it's stronger.
        // We can re-check simple date patterns in text to see if an explicit date was likely.
        if (Patterns.DATE_ANCHORS.some(d => text.includes(d)) || /\d{1,2}\/\d{1,2}/.test(text)) {
            score += 0.2;
            reasons.push('Explicit date found');
        }

        // 4. Card Reference (+0.1)
        if (transaction.cardLast4) {
            score += 0.1;
            reasons.push('Card reference found');
        }

        // 5. Bank Sender (+0.1)
        // Simple heuristic: Does sender contain "bank", "card", "finance", "alert"?
        // Or just assume if we are processing it, the classifier passed it.
        // Let's check typical bank sender domains for bonus points.
        if (this.isBankSender(email.from)) {
            score += 0.1;
            reasons.push('Bank sender verified');
        }

        // Rounding
        score = Math.round(score * 100) / 100;

        // Thresholds
        let status: 'ACCEPT' | 'REVIEW' | 'DISCARD';
        if (score >= 0.75) status = 'ACCEPT';
        else if (score >= 0.5) status = 'REVIEW';
        else status = 'DISCARD';

        return { score, status, reasons };
    }

    private static isBankSender(from: string): boolean {
        const f = from.toLowerCase();
        return f.includes('bank') || f.includes('card') || f.includes('alert') || f.includes('finance') || f.includes('pay');
    }
}
