// rules/CreditCardSpendEvaluatorV3.ts

import { CleanEmailContent } from '../sanitize/sanitizer';
import { HardNegativeGate } from './gates/HardNegativeGate';
import { CreditCardPhraseGate } from './gates/CreditCardPhraseGate';
import { SpendTypeGate } from './gates/SpendTypeGate';
import { InstrumentGate } from './gates/InstrumentGate';

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

    private static CURRENCY = /(?:₹|rs\.?|inr|\$|usd)\s*([\d,]+(?:\.\d{1,2})?)/i;
    private static MASKED_CARD = /(?:\*{2,}|x{2,}|ending\s+)(\d{4})/i;

    private static MERCHANT_NEAR_SPEND =
        /(spent|debited|charged|purchase).{0,40}?(?:at|to)\s+([a-z0-9*&.\- ]{2,40})/i;

    static evaluate(email: CleanEmailContent): EvaluationResult {

        const text = `${email.subject} ${email.cleanedBody}`.toLowerCase();
        const reasons: string[] = [];
        const metadata: any = {};

        // --- GATE 1: HARD NEGATIVES (Salary, OTP, EMI, etc.) ---
        const gate1 = HardNegativeGate.check(text);
        if (!gate1.passed) {
            return {
                decision: 'DISCARD',
                score: 0,
                reasons: [`Gate 1 Fail: ${gate1.reason}`],
                metadata: {}
            };
        }

        // --- GATE 2: CREDIT CARD PHRASE (Must have "credit card" OR trusted sender) ---
        const gate2 = CreditCardPhraseGate.check(text, email.from);
        if (!gate2.passed) {
            return {
                decision: 'DISCARD',
                score: 0,
                reasons: [`Gate 2 Fail: ${gate2.reason}`],
                metadata: {}
            };
        }

        // --- GATE 3: SPEND TYPE (Must be debit/spent, not refund) ---
        const gate3 = SpendTypeGate.check(text);
        if (!gate3.passed) {
            return {
                decision: 'DISCARD',
                score: 0,
                reasons: [`Gate 3 Fail: ${gate3.reason}`],
                metadata: {}
            };
        }

        // --- GATE 4: INSTRUMENT TYPE (No Debit Card / Account Debit) ---
        const gate4 = InstrumentGate.check(text);
        if (!gate4.passed) {
            return {
                decision: 'DISCARD',
                score: 0,
                reasons: [`Gate 4 Fail: ${gate4.reason}`],
                metadata: {}
            };
        }

        // --- IF ALL GATES PASSED -> IT IS A VALID CREDIT CARD SPEND ---
        // Now we just score it to confirm extraction quality and extract metadata

        let score = 0.5; // Base score for passing all gates
        reasons.push('Passed all 4 hard gates');

        // Extract Amount (Critical)
        const amountMatch = text.match(this.CURRENCY);
        if (amountMatch) {
            metadata.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
            score += 0.25;
        } else {
            // Even if gates passed, if no amount, it's useless
            return {
                decision: 'DISCARD',
                score: 0,
                reasons: ['Passed gates but no amount found'],
                metadata: {}
            };
        }

        // Extract Merchant
        const merchantMatch = text.match(this.MERCHANT_NEAR_SPEND);
        if (merchantMatch) {
            metadata.merchant = merchantMatch[2].trim();
            score += 0.15;
        }

        // Extract Card Last 4
        const cardMatch = text.match(this.MASKED_CARD);
        if (cardMatch) {
            metadata.cardLast4 = cardMatch[1];
            score += 0.10;
        }

        // Normalize
        score = Math.min(1, score);

        // Final Decision
        // Since we have hard gates, if we reached here, we are pretty confident.
        // We set decision to ACCEPT if score is high, or REVIEW if something is slightly off but gates passed.

        let decision: EvaluationResult['decision'] = 'ACCEPT';
        // If we want to be safe, maybe 0.75? But gates are strict now.
        if (score < 0.70) decision = 'REVIEW';

        return { decision, score, reasons, metadata };
    }
}
