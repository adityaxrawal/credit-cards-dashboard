/**
 * Payment method types
 */
export type PaymentMethod =
    | 'credit_card'
    | 'debit_card'
    | 'upi'
    | 'netbanking'
    | 'wallet'
    | 'bnpl' // Buy Now Pay Later
    | 'emi'
    | 'cash'
    | 'prepaid'
    | 'bank_transfer'
    | 'unknown';

export interface PaymentMethodResult {
    method: PaymentMethod;
    confidence: number;
    details?: {
        provider?: string;  // e.g., "GPay", "PhonePe"
        network?: string;   // e.g., "Visa", "Mastercard", "RuPay"
        isRecurring?: boolean;
    };
}

/**
 * PaymentMethodDetector - Identify payment method from email content
 */
export class PaymentMethodDetector {
    /**
     * Detect payment method from email content
     */
    static detect(email: {
        subject: string;
        snippet?: string;
        cleanedBody?: string;
    }): PaymentMethodResult {
        const text = `${email.subject} ${email.snippet || ''} ${email.cleanedBody || ''}`.toLowerCase();

        // Check each payment method pattern
        const checks = [
            this.checkCreditCard(text),
            this.checkDebitCard(text),
            this.checkUPI(text),
            this.checkNetbanking(text),
            this.checkWallet(text),
            this.checkBNPL(text),
            this.checkEMI(text),
            this.checkBankTransfer(text),
        ];

        // Return the highest confidence match
        const bestMatch = checks
            .filter(c => c !== null)
            .sort((a, b) => (b?.confidence || 0) - (a?.confidence || 0))[0];

        return bestMatch || {
            method: 'unknown',
            confidence: 0
        };
    }

    /**
     * Check for credit card patterns
     */
    private static checkCreditCard(text: string): PaymentMethodResult | null {
        const patterns = [
            { pattern: /credit\s*card/i, confidence: 0.95 },
            { pattern: /cc\s+[*x#]?\d{4}/i, confidence: 0.9 },
            { pattern: /card\s+(?:ending|number).*\d{4}/i, confidence: 0.7 },
            { pattern: /visa|mastercard|amex|american\s*express|rupay/i, confidence: 0.85 },
            { pattern: /credit\s+limit|available\s+limit/i, confidence: 0.7 },
        ];

        for (const { pattern, confidence } of patterns) {
            if (pattern.test(text)) {
                const network = this.detectNetwork(text);
                return {
                    method: 'credit_card',
                    confidence,
                    details: { network }
                };
            }
        }

        return null;
    }

    /**
     * Check for debit card patterns
     */
    private static checkDebitCard(text: string): PaymentMethodResult | null {
        const patterns = [
            { pattern: /debit\s*card/i, confidence: 0.95 },
            { pattern: /atm\s+(?:card|withdrawal)/i, confidence: 0.9 },
            { pattern: /debit\s+from.*(?:savings|current)\s+a\/c/i, confidence: 0.85 },
        ];

        for (const { pattern, confidence } of patterns) {
            if (pattern.test(text)) {
                const network = this.detectNetwork(text);
                return {
                    method: 'debit_card',
                    confidence,
                    details: { network }
                };
            }
        }

        return null;
    }

    /**
     * Check for UPI patterns
     */
    private static checkUPI(text: string): PaymentMethodResult | null {
        const patterns = [
            { pattern: /upi\s+(?:id|payment|transfer|transaction)/i, confidence: 0.95 },
            { pattern: /vpa|upi@|@(?:ybl|paytm|oksbi|okicici|okaxis)/i, confidence: 0.95 },
            { pattern: /(?:google\s*pay|gpay|phonepe|paytm|bhim)/i, confidence: 0.9 },
            { pattern: /upi\s+ref/i, confidence: 0.9 },
        ];

        for (const { pattern, confidence } of patterns) {
            if (pattern.test(text)) {
                const provider = this.detectUPIProvider(text);
                return {
                    method: 'upi',
                    confidence,
                    details: { provider }
                };
            }
        }

        return null;
    }

    /**
     * Check for netbanking patterns
     */
    private static checkNetbanking(text: string): PaymentMethodResult | null {
        const patterns = [
            { pattern: /net\s*banking/i, confidence: 0.95 },
            { pattern: /internet\s+banking/i, confidence: 0.95 },
            { pattern: /online\s+banking\s+(?:transfer|payment)/i, confidence: 0.85 },
        ];

        for (const { pattern, confidence } of patterns) {
            if (pattern.test(text)) {
                return {
                    method: 'netbanking',
                    confidence,
                };
            }
        }

        return null;
    }

    /**
     * Check for wallet patterns
     */
    private static checkWallet(text: string): PaymentMethodResult | null {
        const patterns = [
            { pattern: /(?:paytm|mobikwik|amazon\s*pay|freecharge)\s+wallet/i, confidence: 0.95 },
            { pattern: /wallet\s+(?:balance|payment|transfer)/i, confidence: 0.85 },
            { pattern: /prepaid\s+wallet/i, confidence: 0.85 },
        ];

        for (const { pattern, confidence } of patterns) {
            if (pattern.test(text)) {
                const provider = this.detectWalletProvider(text);
                return {
                    method: 'wallet',
                    confidence,
                    details: { provider }
                };
            }
        }

        return null;
    }

    /**
     * Check for BNPL (Buy Now Pay Later) patterns
     */
    private static checkBNPL(text: string): PaymentMethodResult | null {
        const patterns = [
            { pattern: /(?:simpl|lazypay|zestmoney|flexipay|paytm\s+postpaid)/i, confidence: 0.95 },
            { pattern: /buy\s+now\s+pay\s+later|bnpl/i, confidence: 0.9 },
            { pattern: /pay\s+(?:later|in\s+parts)/i, confidence: 0.7 },
        ];

        for (const { pattern, confidence } of patterns) {
            if (pattern.test(text)) {
                return {
                    method: 'bnpl',
                    confidence,
                };
            }
        }

        return null;
    }

    /**
     * Check for EMI patterns
     */
    private static checkEMI(text: string): PaymentMethodResult | null {
        const patterns = [
            { pattern: /emi\s+(?:payment|debit|instalment)/i, confidence: 0.95 },
            { pattern: /(?:no\s+cost|zero\s+cost)\s+emi/i, confidence: 0.95 },
            { pattern: /(?:monthly|quarterly)\s+instalment/i, confidence: 0.85 },
            { pattern: /bajaj\s+finserv.*emi/i, confidence: 0.9 },
        ];

        for (const { pattern, confidence } of patterns) {
            if (pattern.test(text)) {
                return {
                    method: 'emi',
                    confidence,
                    details: { isRecurring: true }
                };
            }
        }

        return null;
    }

    /**
     * Check for bank transfer patterns (NEFT/RTGS/IMPS)
     */
    private static checkBankTransfer(text: string): PaymentMethodResult | null {
        const patterns = [
            { pattern: /neft|rtgs|imps/i, confidence: 0.95 },
            { pattern: /fund\s+transfer/i, confidence: 0.85 },
            { pattern: /bank\s+transfer/i, confidence: 0.8 },
        ];

        for (const { pattern, confidence } of patterns) {
            if (pattern.test(text)) {
                return {
                    method: 'bank_transfer',
                    confidence,
                };
            }
        }

        return null;
    }

    /**
     * Detect card network
     */
    private static detectNetwork(text: string): string | undefined {
        if (/visa/i.test(text)) return 'Visa';
        if (/master\s*card/i.test(text)) return 'Mastercard';
        if (/amex|american\s*express/i.test(text)) return 'Amex';
        if (/rupay/i.test(text)) return 'RuPay';
        if (/diners/i.test(text)) return 'Diners';
        return undefined;
    }

    /**
     * Detect UPI provider
     */
    private static detectUPIProvider(text: string): string | undefined {
        if (/google\s*pay|gpay/i.test(text)) return 'GPay';
        if (/phonepe/i.test(text)) return 'PhonePe';
        if (/paytm/i.test(text)) return 'Paytm';
        if (/bhim/i.test(text)) return 'BHIM';
        if (/amazon\s*pay/i.test(text)) return 'AmazonPay';
        if (/whatsapp\s*pay/i.test(text)) return 'WhatsAppPay';
        return undefined;
    }

    /**
     * Detect wallet provider
     */
    private static detectWalletProvider(text: string): string | undefined {
        if (/paytm/i.test(text)) return 'Paytm';
        if (/mobikwik/i.test(text)) return 'Mobikwik';
        if (/amazon\s*pay/i.test(text)) return 'AmazonPay';
        if (/freecharge/i.test(text)) return 'Freecharge';
        return undefined;
    }
}
