import { CleanEmailContent } from '../sanitize/sanitizer';

export type EmailIntent =
    | "CREDIT_CARD_TRANSACTION"
    | "CREDIT_CARD_STATEMENT"
    | "NON_FINANCIAL";

export interface FilterResult {
    intent: EmailIntent;
    shouldProcess: boolean; // Kept for backward compat locally, effectively intent !== NON_FINANCIAL
    reason: string;
    category: string;
}

export class FilterService {
    // Whitelist of Bank Sender Domains for Gmail Query
    static SENDER_DOMAINS = [
        'hdfcbank.net',
        'icicibank.com',
        'sbicard.com',
        'axisbank.com',
        'americanexpress.com',
        'citibank.com',
        'hsbc.com',
        'kotak.com',
        'indusind.com',
        'rblbank.com'
    ];

    /**
     * Signal-Based Classification (Delegated to EmailClassifier)
     */
    static filter(email: CleanEmailContent): FilterResult {
        const { EmailClassifier } = require('../extraction/classifier');
        const kind = EmailClassifier.classify(email);

        let intent: EmailIntent;
        let reason = 'Signal-based classification';
        let category = 'UNKNOWN';

        switch (kind) {
            case 'TRANSACTION_ALERT':
                intent = "CREDIT_CARD_TRANSACTION";
                reason = "Transaction Signals Detected";
                category = "TRANSACTION";
                break;
            case 'CREDIT_CARD_STATEMENT':
                intent = "CREDIT_CARD_STATEMENT";
                reason = "Statement Signals Detected";
                category = "STATEMENT";
                break;
            case 'NON_FINANCIAL':
            default:
                intent = "NON_FINANCIAL";
                reason = "Insufficient Financial Signals";
                category = "OTHER";
                break;
        }

        return {
            intent,
            shouldProcess: intent !== "NON_FINANCIAL",
            reason,
            category
        };
    }
}
