/**
 * Gate 2: Credit Card Phrase Validator
 * Enforces explicit "credit card" requirement
 * 
 * Examples:
 * - "credit card" phrase found → PASS
 * - "visa", "mastercard" found → PASS
 * - Sender is hdfc.com → PASS (with high confidence)
 * - No card mention → FAIL
 */
export class CreditCardPhraseValidator {
    private readonly EXPLICIT_PHRASES = [
        /credit\s+card/i,
        /\bvisa\b/i,
        /\bmastercard\b/i,
        /\brupay\b/i,
        /\bamex\b/i,
        /\bamericanexpress\b/i,
        /\bdiners\s+club\b/i,
        /credit\s+(?:card)?\s+(?:ending|debit|charged|debited)/i,
    ];

    private readonly CARD_ISSUER_DOMAINS = [
        '@hdfc', '@hdfcbank',
        '@sbi', '@sbicard',
        '@icici', '@icicicard',
        '@axis', '@axiscard',
        '@kotak', '@kotakcard',
        '@yes', '@yesbank',
        '@idfc', '@idfcbank',
        '@amex', '@americanexpress',
        '@diners',
        '@jupiter',
        '@simpl',
        '@citi', '@citicard',
        '@hsbc', '@hsbccard',
        '@sc', '@standardchartered',
        '@airtel',
        '@airtelaxis',
    ];

    validate(
        text: string,
        sender: string
    ): { hasCreditCardPhrase: boolean; confidence: number } {
        const lowerText = text.toLowerCase();
        const lowerSender = sender.toLowerCase();

        // Check explicit phrases (high confidence)
        for (const phrase of this.EXPLICIT_PHRASES) {
            if (lowerText.match(phrase)) {
                return {
                    hasCreditCardPhrase: true,
                    confidence: 0.95,
                };
            }
        }

        // Check if sender is card issuer domain (medium confidence)
        for (const domain of this.CARD_ISSUER_DOMAINS) {
            if (lowerSender.includes(domain)) {
                return {
                    hasCreditCardPhrase: true,
                    confidence: 0.80,
                };
            }
        }

        return {
            hasCreditCardPhrase: false,
            confidence: 0,
        };
    }
}
