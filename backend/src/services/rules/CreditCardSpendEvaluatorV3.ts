// rules/CreditCardSpendEvaluatorV3.ts

import { CleanEmailContent } from '../sanitize/sanitizer';

export interface EvaluationResult {
    decision: 'ACCEPT' | 'REVIEW' | 'DISCARD';
    score: number;
    reasons: string[];
    metadata: {
        amount?: number;
        merchant?: string;
        cardLast4?: string;
        date?: Date;
    };
}

export class CreditCardSpendEvaluatorV3 {

    // --- HARD NEGATIVES ---
    private static HARD_EXCLUDE = [
        'otp', 'authorization', 'statement generated',
        'emi schedule', 'emi conversion',
        'limit increase', 'card blocked'
    ];

    // --- SOFT NEGATIVES ---
    private static SOFT_EXCLUDE = [
        'available balance', 'credit limit',
        'minimum due', 'total due',
        'payment successful', 'bill payment'
    ];

    // --- POSITIVE SIGNALS ---
    private static SPEND_VERBS = [
        'spent', 'debited', 'charged',
        'purchase', 'used at', 'txn of'
    ];

    private static CARD_MARKERS = [
        'credit card', 'card ending', 'ending in'
    ];

    private static CURRENCY = /(?:₹|rs\.?|inr|\$|usd)\s*([\d,]+(?:\.\d{1,2})?)/i;
    private static MASKED_CARD = /(?:\*{2,}|x{2,}|ending\s+)(\d{4})/i;

    private static MERCHANT_NEAR_SPEND =
        /(spent|debited|charged|purchase).{0,40}?(?:at|to)\s+([a-z0-9*&.\- ]{2,40})/i;

    static evaluate(email: CleanEmailContent): EvaluationResult {

        const text = `${email.subject} ${email.cleanedBody}`.toLowerCase();
        const reasons: string[] = [];
        const metadata: any = {};
        let score = 0;

        // 1. HARD EXCLUDE
        if (this.HARD_EXCLUDE.some(k => text.includes(k))) {
            return {
                decision: 'DISCARD',
                score: 0,
                reasons: ['Hard negative detected'],
                metadata: {}
            };
        }

        // 2. AMOUNT + VERB (MANDATORY)
        const amountMatch = text.match(this.CURRENCY);
        const hasVerb = this.SPEND_VERBS.some(v => text.includes(v));

        if (!amountMatch || !hasVerb) {
            return {
                decision: 'DISCARD',
                score: 0,
                reasons: ['Missing debit signal'],
                metadata: {}
            };
        }

        metadata.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
        score += 0.35;
        reasons.push('Debit amount + verb');

        // 3. CARD CONFIRMATION
        const cardMatch = text.match(this.MASKED_CARD);
        if (
            this.CARD_MARKERS.some(k => text.includes(k)) ||
            cardMatch
        ) {
            score += 0.25;
            reasons.push('Credit card reference');
            if (cardMatch) metadata.cardLast4 = cardMatch[1];
        }

        // 4. MERCHANT (PROXIMITY-BASED)
        const merchantMatch = text.match(this.MERCHANT_NEAR_SPEND);
        if (merchantMatch) {
            metadata.merchant = merchantMatch[2].trim();
            score += 0.25;
            reasons.push('Merchant near spend verb');
        }

        // 5. DATE
        if (email.date) {
            score += 0.05;
        }

        // 6. SOFT NEGATIVES
        if (this.SOFT_EXCLUDE.some(k => text.includes(k))) {
            score -= 0.15;
            reasons.push('Soft negative context');
        }

        // Normalize
        score = Math.max(0, Math.min(1, Math.round(score * 100) / 100));

        // Decision
        let decision: EvaluationResult['decision'] = 'DISCARD';
        if (score >= 0.75) decision = 'ACCEPT';
        else if (score >= 0.55) decision = 'REVIEW';

        return { decision, score, reasons, metadata };
    }
}
