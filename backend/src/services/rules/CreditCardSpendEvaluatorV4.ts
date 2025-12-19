import { HardNegativeValidator } from './HardNegativeValidator';
import { CreditCardPhraseValidator } from './CreditCardPhraseValidator';
import { SpendTypeValidator } from './SpendTypeValidator';
import { InstrumentValidator } from './InstrumentValidator';

export interface EvaluationResult {
    decision: 'ACCEPT' | 'REVIEW' | 'DISCARD';
    score: number; // 0.0 to 1.0
    reasons: string[];
    metadata: {
        amount?: number;
        merchant?: string;
        cardLast4?: string;
        transactionDate?: Date;
    };
}

/**
 * CreditCardSpendEvaluatorV4
 * 4-Gate validation pipeline for credit card transactions
 * 
 * Gate 1: Hard Negatives (salary, refund, OTP, etc.)
 * Gate 2: Credit Card Phrase (must have "credit card" or card sender)
 * Gate 3: Spend Type (debit verb, not refund)
 * Gate 4: Instrument (credit card, not debit/account/plain UPI)
 * 
 * After passing all 4 gates:
 *   Score >= 0.80 → ACCEPT
 *   Score 0.60-0.79 → REVIEW (send to GPT)
 *   Score < 0.60 → DISCARD
 */
export class CreditCardSpendEvaluatorV4 {
    private static readonly ACCEPT_THRESHOLD = 0.80;
    private static readonly REVIEW_THRESHOLD = 0.60;

    private static hardNegative = new HardNegativeValidator();
    private static ccPhrase = new CreditCardPhraseValidator();
    private static spendType = new SpendTypeValidator();
    private static instrument = new InstrumentValidator();

    static evaluate(email: any): EvaluationResult {
        const text = email.cleanedBody || email.body || '';
        const subject = email.subject || '';
        const combinedText = `${subject} ${text}`;
        const sender = email.from || '';

        const reasons: string[] = [];
        let score = 0;

        // GATE 1: Hard Negatives
        const hardNegResult = this.hardNegative.validate(combinedText);
        if (hardNegResult.isHardNegative) {
            reasons.push(`Gate 1 FAIL: ${hardNegResult.reason}`);
            return {
                decision: 'DISCARD',
                score: 0,
                reasons,
                metadata: {},
            };
        }
        score += 0.20;
        reasons.push('Gate 1 PASS: No hard negatives');

        // GATE 2: Credit Card Phrase
        const ccResult = this.ccPhrase.validate(combinedText, sender);
        if (!ccResult.hasCreditCardPhrase) {
            reasons.push('Gate 2 FAIL: No credit card phrase found');
            return {
                decision: 'DISCARD',
                score: 0,
                reasons,
                metadata: {},
            };
        }
        score += 0.20;
        reasons.push(`Gate 2 PASS: Credit card phrase found (conf: ${ccResult.confidence})`);

        // GATE 3: Spend Type
        const spendResult = this.spendType.validate(combinedText);
        if (!spendResult.isValidSpend) {
            reasons.push(`Gate 3 FAIL: ${spendResult.reason}`);
            return {
                decision: 'DISCARD',
                score: 0,
                reasons,
                metadata: {},
            };
        }
        score += 0.20;
        reasons.push('Gate 3 PASS: Valid spend type (debit verb found)');

        // GATE 4: Instrument
        const instrumentResult = this.instrument.validate(combinedText);
        if (!instrumentResult.isValidInstrument) {
            reasons.push(`Gate 4 FAIL: ${instrumentResult.reason}`);
            return {
                decision: 'DISCARD',
                score: 0,
                reasons,
                metadata: {},
            };
        }
        score += 0.20;
        reasons.push('Gate 4 PASS: Valid instrument (credit card confirmed)');

        // All gates passed: base score is 0.80
        // Now extract details for bonus points

        const metadata = this.extractDetails(combinedText);

        // Bonuses for extracted details
        if (metadata.amount) {
            score += 0.15;
            reasons.push(`Amount extracted: ${metadata.amount}`);
        }
        if (metadata.merchant) {
            score += 0.15;
            reasons.push(`Merchant extracted: ${metadata.merchant}`);
        }
        if (metadata.cardLast4) {
            score += 0.10;
            reasons.push(`Card last 4 extracted: ${metadata.cardLast4}`);
        }
        if (metadata.transactionDate) {
            score += 0.05;
            reasons.push(`Date extracted: ${metadata.transactionDate.toDateString()}`);
        }

        // Cap score at 1.0
        score = Math.min(score, 1.0);

        // Decide
        let decision: 'ACCEPT' | 'REVIEW' | 'DISCARD';
        if (score >= this.ACCEPT_THRESHOLD) {
            decision = 'ACCEPT';
        } else if (score >= this.REVIEW_THRESHOLD) {
            decision = 'REVIEW';
        } else {
            decision = 'DISCARD';
        }

        return {
            decision,
            score: parseFloat(score.toFixed(2)),
            reasons,
            metadata,
        };
    }

    private static extractDetails(text: string): {
        amount?: number;
        merchant?: string;
        cardLast4?: string;
        transactionDate?: Date;
    } {
        const metadata: any = {};

        // Extract amount
        const amountMatch = text.match(/₹\s?([\d,]+(?:\.\d{2})?)/);
        if (amountMatch) {
            metadata.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
        } else {
            const amountMatch2 = text.match(/(?:rs\.?|inr)\s+([\d,]+(?:\.\d{2})?)/i);
            if (amountMatch2) {
                metadata.amount = parseFloat(amountMatch2[1].replace(/,/g, ''));
            }
        }

        // Extract merchant
        const merchantMatch = text.match(
            /(?:spent|charged|paid|at)\s+(?:at|to|by)?\s*([A-Za-z\s&.'-]+?)(?:\s+on|-|\d|$)/i
        );
        if (merchantMatch) {
            metadata.merchant = merchantMatch[1].trim();
        }

        // Extract card last 4
        const cardMatch = text.match(
            /(?:ending|ending in|ending\s+in|xxx|xxxx|\*{4})\s*(?:xx)?(\d{4})/i
        );
        if (cardMatch) {
            metadata.cardLast4 = cardMatch[1];
        }

        // Extract date
        const dateMatch = text.match(
            /(\d{1,2})\-([A-Za-z]{3})\-(\d{4})/
        );
        if (dateMatch) {
            const monthMap: any = {
                'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3,
                'may': 4, 'jun': 5, 'jul': 6, 'aug': 7,
                'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11,
            };
            const month = monthMap[dateMatch[2].toLowerCase()];
            if (month !== undefined) {
                metadata.transactionDate = new Date(
                    parseInt(dateMatch[3]),
                    month,
                    parseInt(dateMatch[1])
                );
            }
        }

        return metadata;
    }
}
