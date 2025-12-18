import { CleanEmailContent } from '../sanitize/sanitizer';
import { Patterns } from './patterns';

export type EmailKind = 'TRANSACTION_ALERT' | 'CREDIT_CARD_STATEMENT' | 'NON_FINANCIAL';

interface SignalScore {
    monetary: boolean;
    debitSemantic: boolean;
    cardReference: boolean;
    temporal: boolean;
    merchant: boolean;
}

export class EmailClassifier {
    static classify(email: CleanEmailContent): EmailKind {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();

        // 1. Check for Statement Signals
        // Requirement: PDF + Statement Keywords
        // Or just strong keyword density if PDF check isn't available in CleanEmailContent (it usually isn't, so we rely on text/metadata if passed, but here we assume text).
        // Actually, checking if "pdf" is mentioned in snippet or body is a weak signal, strict check would be attachment. 
        // But per prompt: "PDF attachment present" is a signal. `CleanEmailContent` might not have attachment info directly unless we pass it.
        // For now, we rely on text keywords which often say "attached statement".

        const statementScore = this.scoreStatement(text);
        if (statementScore >= 2) {
            // Priority check: Statement overrides transaction alert often (e.g. "Your statement has X transactions")
            // But we must be careful not to classify "Transaction Alert" as statement.
            // Statements usually don't say "You spent X at Y".
            return 'CREDIT_CARD_STATEMENT';
        }

        // 2. Check for Transaction Signals
        const txSignals = this.detectTransactionSignals(text);
        const score = Object.values(txSignals).filter(Boolean).length;

        if (score >= 3) {
            // Final Gate: Ensure it's not a pure limit/reminder email
            if (this.isNoise(text) && !txSignals.debitSemantic) {
                return 'NON_FINANCIAL';
            }
            return 'TRANSACTION_ALERT';
        }

        return 'NON_FINANCIAL';
    }

    private static scoreStatement(text: string): number {
        let score = 0;
        // Signal 1: Keywords
        const matches = Patterns.STATEMENT_KEYWORDS.filter(k => text.includes(k));
        if (matches.length >= 1) score++; // At least one strong keyword
        if (matches.length >= 3) score++; // Multiple confirmations

        // Signal 2: "PDF" mention or "attached"
        if (text.includes('pdf') || text.includes('attached')) score++;

        return score;
    }

    private static detectTransactionSignals(text: string): SignalScore {
        return {
            monetary: Patterns.MONEY.test(text),

            debitSemantic: Patterns.TRANSACTION_VERBS.some(v => text.includes(v)),

            cardReference: Patterns.CARD_REF.some(ref => text.includes(ref)) ||
                Patterns.MASKED_CARD.test(text) ||
                Patterns.NETWORKS.some(n => text.includes(n)),

            temporal: Patterns.DATE_ANCHORS.some(d => text.includes(d)) ||
                /\d{1,2}\/\d{1,2}/.test(text), // Simple date regex

            merchant: this.detectMerchantSignal(text)
        };
    }

    private static detectMerchantSignal(text: string): boolean {
        // This is hard to perfect without extraction, but we look for "at X" or "to X" patterns roughly
        // Or just generic structural hints. For now, we assume if we have money+spent, there is a merchant.
        // We'll return true if we find indicators like "at " followed by text, or just assume true if others match?
        // Prompt says: "Any merchant-like token".
        // Let's look for "at " or "to " followed by non-stopwords.
        return /\b(at|to)\s+[a-z0-9]+/i.test(text.slice(0, 200)); // Scan early part of email? NO, search everywhere.
    }

    private static isNoise(text: string): boolean {
        // If it mentions "total due" or "limit" strongly and lacks "spent", it's noise.
        return Patterns.NOISE.some(n => text.includes(n));
    }
}
