/**
 * Gate 4: Instrument Validator
 * Confirms transaction is from credit card
 * (not debit card, not bank account, not plain UPI)
 * 
 * Examples:
 * - "credit card debited" → PASS
 * - "debit card debited" → FAIL
 * - "account debited" → FAIL
 * - "UPI transfer" → FAIL (unless "credit card UPI")
 * - "RuPay credit card UPI" → PASS (special case)
 */
export class InstrumentValidator {
    private readonly DEBIT_CARD = [
        /debit\s+card/i,
        /atm\s+card/i,
        /savings\s+account\s+card/i,
    ];

    private readonly BANK_ACCOUNT = [
        /(?:your\s+)?(?:savings\s+)?account(?:\s+has)?\s+(?:been\s+)?debited/i,
        /account\s+debit/i,
        /deducted\s+from\s+account/i,
        /account\s+deduction/i,
    ];

    private readonly UPI_PLAIN = [
        /\bupi\b/i,
        /upi\s+(?:transfer|payment)/i,
        /via\s+upi/i,
    ];

    private readonly CREDIT_CARD_PHRASES = [
        /credit\s+card/i,
        /\bvisa\b/i,
        /\bmastercard\b/i,
        /\brupay\b/i,
        /\bamex\b/i,
    ];

    validate(text: string): {
        isValidInstrument: boolean;
        instrumentType?: string;
        reason?: string;
    } {
        const lowerText = text.toLowerCase();

        // Check for credit card phrase first
        const hasCCPhrase = this.CREDIT_CARD_PHRASES.some(p =>
            lowerText.match(p)
        );

        // Hard reject: account debit
        for (const pattern of this.BANK_ACCOUNT) {
            if (lowerText.match(pattern)) {
                return {
                    isValidInstrument: false,
                    instrumentType: 'bank_account',
                    reason: 'Transaction is from bank account, not credit card',
                };
            }
        }

        // Reject: debit card (unless has explicit CC phrase)
        for (const pattern of this.DEBIT_CARD) {
            if (lowerText.match(pattern)) {
                if (!hasCCPhrase) {
                    return {
                        isValidInstrument: false,
                        instrumentType: 'debit_card',
                        reason: 'Transaction is from debit card, not credit card',
                    };
                }
            }
        }

        // Reject: plain UPI (unless CC phrase present)
        for (const pattern of this.UPI_PLAIN) {
            if (lowerText.match(pattern)) {
                // Special case: RuPay Credit Card UPI, IDFC UPI, etc.
                if (!hasCCPhrase) {
                    return {
                        isValidInstrument: false,
                        instrumentType: 'upi',
                        reason: 'Transaction is UPI, not from credit card',
                    };
                }
                // Otherwise, it's credit card UPI - allow it
            }
        }

        return {
            isValidInstrument: true,
            instrumentType: hasCCPhrase ? 'credit_card' : 'unknown',
        };
    }
}
