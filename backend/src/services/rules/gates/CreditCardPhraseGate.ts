
export class CreditCardPhraseGate {
    private static CC_PHRASES = [
        /credit\s+card/i,
        /visa/i,
        /mastercard/i,
        /rupay/i,
        /amex/i,
        /card\s+ending/i,
        /ending\s+in/i
    ];

    private static TRUSTED_SENDERS = [
        '@hdfcbank.net',
        '@hdfcbank.com',
        '@axisbank.com',
        '@icicibank.com',
        '@sbi.co.in'
    ];

    static check(text: string, sender: string): { passed: boolean; reason?: string } {
        const hasCCPhrase = this.CC_PHRASES.some(p => p.test(text));

        // Sender check is a fallback if phrase is weak, but for now we enforce phrase OR strong domain hint
        // Actually, request said "Make 'credit card' phrase MANDATORY" but also "OR isCCDomain"

        const isCCDomain = this.TRUSTED_SENDERS.some(d => sender.toLowerCase().includes(d));

        if (!hasCCPhrase && !isCCDomain) {
            return {
                passed: false,
                reason: 'No credit card phrase or trusted sender found'
            };
        }

        return { passed: true };
    }
}
