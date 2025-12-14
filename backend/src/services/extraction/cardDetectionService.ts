import pool from '../../lib/db';
import * as cardsQueries from '../../db/queries/cards.queries';

interface CardDetectionResult {
    last4Digits: string;
    cardName?: string;
    bankName: string;
    confidence: number;
    detectionMethod: 'regex' | 'fuzzy' | 'manual' | 'heuristic';
    raw?: {
        extractedLast4: string;
        bankDomainLast4?: string;
        subjectMention?: string;
    };
    status?: 'CREATE_CARD' | 'FOUND';
}

export class CardDetectionService {
    /**
     * Extract card number from email with multiple fallback strategies
     * STRICT validation to prevent mismatches
     */
    async detectCardFromEmail(
        userId: string,
        email: { subject: string; body: string; from: string },
        extractedBankName?: string
    ): Promise<CardDetectionResult | { status: 'CREATE_CARD'; bankName: string; last4: string }> {

        const combined = email.subject + '\n' + email.body;

        // STRATEGY 1: Extract via strict regex pattern from email body
        let regexResult = this.extractViaRegex(combined, email.from);

        if (!regexResult) {
            // STRATEGY 2: Extract bank name and last4 from email hints
            // "HDFC Bank RuPay Credit Card XX0614" → HDFC + 0614
            const bankMatch = combined.match(/(?:hdfc|axis|sbi|icici|yes bank|idfc)/i);
            const last4Match = combined.match(/(?:card|account).*?xx(\d{4})/i) ||
                combined.match(/(?:ending\s+)?(\d{4})(?!\d)/i);

            if (bankMatch && last4Match) {
                regexResult = {
                    last4Digits: last4Match[1],
                    bankName: this.normalizeBankName(bankMatch[0]),
                    confidence: 0.65,
                    detectionMethod: 'heuristic',
                    raw: {
                        extractedLast4: last4Match[0]
                    }
                };
            }
        }

        if (!regexResult) {
            // Cannot extract - return pending for manual review
            throw new Error('Could not detect card number from email');
        }

        // STRATEGY 3: Match against existing cards
        const existingCard = await cardsQueries.findCardByBankAndLastFour(
            userId,
            regexResult.bankName,
            regexResult.last4Digits
        );

        if (existingCard) {
            return {
                last4Digits: regexResult.last4Digits,
                cardName: existingCard.card_name,
                bankName: existingCard.bank_name,
                confidence: 0.95,
                detectionMethod: regexResult.detectionMethod,
                status: 'FOUND'
            };
        }

        // STRATEGY 4: Auto-create card if extraction confident enough
        if (regexResult.confidence >= 0.65) {
            return {
                status: 'CREATE_CARD',
                bankName: regexResult.bankName,
                last4: regexResult.last4Digits,
            };
        }

        throw new Error(
            `Cannot reliably detect card (confidence: ${regexResult.confidence}). Please manually map.`
        );
    }

    private normalizeBankName(bank: string): string {
        const mapping: Record<string, string> = {
            'hdfc': 'HDFC',
            'axis': 'AXIS',
            'sbi': 'SBI',
            'icici': 'ICICI',
            'yes bank': 'YES Bank',
            'idfc': 'IDFC',
        };

        const lower = bank.toLowerCase();
        for (const [key, val] of Object.entries(mapping)) {
            if (lower.includes(key)) return val;
        }
        return 'Unknown';
    }

    /**
     * Extract last 4 digits via strict regex patterns
     */
    private extractViaRegex(
        emailText: string,
        fromAddress: string
    ): CardDetectionResult | null {
        // EXPANDED patterns covering all formats seen in CSV
        const patterns: Record<string, RegExp[]> = {
            HDFC: [
                /credit card (?:xx|ending\s+)?(\d{4})/i,
                /card ending (\d{4})/i,
                /card xx(\d{4})/i,
                /card ending in (\d{4})/i,
                /(?:hdfc|credit card).*?(\d{4})/i,
                /ending : (\d{4})/i
            ],
            AXIS: [
                /axis.*?card.*?(\d{4})/i,
                /card no\.?\s*(?:xx)?(\d{4})/i,
                /(?:axis|credit card).*?(\d{4})/i,
                /ending (\d{4})/i
            ],
            SBI: [
                /sbi.*?card.*?(?:xx|ending\s+)?(\d{4})/i,
                /sbi.*?(\d{4})/i,
                /card ending (\d{4})/i,
                /ending with (\d{4})/i
            ],
            GENERIC: [
                /(?:card|credit)\s+(?:xx|ending\s+in\s+)?(\d{4})/i,
                /card\s+(\d{4})/i,
                /ending\s+(\d{4})/i,
                /xx(\d{4})/i,
            ]
        };

        // Identify bank from sender
        const bank = this.identifyBank(fromAddress);
        const bankPatterns = bank && patterns[bank] ? patterns[bank] : patterns.GENERIC;

        for (const pattern of bankPatterns) {
            const match = emailText.match(pattern);
            if (match && match[1]) {
                const last4 = match[1];

                // Validate: must be exactly 4 digits and not all same (1111, 2222 = invalid)
                if (/^\d{4}$/.test(last4) && !/^(\d)\1{3}$/.test(last4)) {
                    return {
                        last4Digits: last4,
                        bankName: bank || 'Unknown',
                        confidence: bank ? 0.90 : 0.70,
                        detectionMethod: 'regex',
                        raw: {
                            extractedLast4: last4,
                            bankDomainLast4: bank || undefined
                        }
                    };
                }
            }
        }

        return null;
    }

    /**
     * Identify bank from email sender domain
     */
    private identifyBank(fromAddress: string): string | null {
        const bankDomains: Record<string, string> = {
            'hdfc': 'HDFC',
            'icici': 'ICICI',
            'axis': 'AXIS',
            'sbi': 'SBI',
            'indusind': 'INDUSIND',
            'kotak': 'KOTAK',
            'hsbc': 'HSBC',
            'citi': 'CITI',
            'amex': 'AMEX',
            'americanexpress': 'AMEX',
            'bofa': 'BOFA',
            'rbl': 'RBL',
            'sc.com': 'SC',
            'standardchartered': 'SC'
        };

        for (const [domain, bank] of Object.entries(bankDomains)) {
            if (fromAddress.toLowerCase().includes(domain)) {
                return bank;
            }
        }

        return null;
    }

    /**
     * Extract bank name from sender domain
     */
    private extractFromBankDomain(fromAddress: string): CardDetectionResult | null {
        const bank = this.identifyBank(fromAddress);
        if (!bank) return null;

        return {
            last4Digits: '',  // Not extractable from domain alone
            bankName: bank,
            confidence: 0.40,
            detectionMethod: 'regex',
            raw: {
                extractedLast4: '',
                bankDomainLast4: bank
            }
        };
    }
}

export const cardDetectionService = new CardDetectionService();
