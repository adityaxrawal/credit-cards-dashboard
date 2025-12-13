import pool from '../../lib/db';

interface CardDetectionResult {
    last4Digits: string;
    cardName?: string;
    bankName: string;
    confidence: number;
    detectionMethod: 'regex' | 'fuzzy' | 'manual';
    raw: {
        extractedLast4: string;
        bankDomainLast4?: string;
        subjectMention?: string;
    };
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
    ): Promise<CardDetectionResult> {

        const combined = email.subject + '\n' + email.body;

        // STRATEGY 1: Extract via strict regex pattern from email body
        const regexResult = this.extractViaRegex(combined, email.from);
        if (regexResult && regexResult.confidence >= 0.85) {
            // Check if this regex result matches a known card for the user?
            // Step 3 fuzzy match does this. We should probably return regex result 
            // but maybe verify it later.
            // Actually Strategy 3 handles matching against DB.
            // So here we just return the raw extraction if high confidence 
            // BUT Strategy 3 says "fuzzy matches existing card".
            // Let's flow through: regex -> then check if it matches existing card strictly or fuzzy.
        }

        // STRATEGY 2: Extract from sender domain (if email is from bank)
        const bankDomainResult = this.extractFromBankDomain(email.from);

        // Combine Regex + Bank Domain
        if (bankDomainResult && regexResult) {
            // Cross-validate: regex last4 matches domain hint?
            // Domain doesn't usually give last4. 
            // But if regex found a bank name that mismatches domain bank, we have a problem.
            if (regexResult.bankName && regexResult.bankName !== bankDomainResult.bankName) {
                // Mismatch!
                console.warn(`[CardDetection] Mismatch: Regex found ${regexResult.bankName} but domain is ${bankDomainResult.bankName}`);
                // Trust Domain for bank name, but regex for last4?
                // Usually regex is specific "HDFC Card ending...".
                // If email is from HDFC but regex says "SBI Card ending...", it might be a payment to SBI?
                // We should proceed with caution.
            }
        }

        // Prepare candidate to match against DB
        const candidateLast4 = regexResult?.last4Digits;
        const candidateBank = regexResult?.bankName || extractedBankName || bankDomainResult?.bankName;

        if (candidateLast4) {
            // STRATEGY 3: Fuzzy match against user's existing cards
            const fuzzyMatch = await this.fuzzyMatchExistingCard(
                userId,
                candidateLast4,
                candidateBank
            );

            if (fuzzyMatch) {
                // Found an existing card!
                return {
                    last4Digits: candidateLast4,
                    bankName: candidateBank || 'Unknown',
                    cardName: fuzzyMatch.cardName,
                    confidence: 0.95,
                    detectionMethod: 'fuzzy',
                    raw: { extractedLast4: candidateLast4 }
                };
            }

            // If no fuzzy match but we have a valid regex extraction
            if (regexResult) {
                return regexResult;
            }
        }

        // STRATEGY 4: Manual mapping check / Fallback
        // If we only know bank but no last4, or nothing.

        if (regexResult?.last4Digits) {
            return {
                ...regexResult,
                confidence: 0.30,
                detectionMethod: 'manual'
            };
        }

        throw new Error('Could not detect card number from email');
    }

    /**
     * Extract last 4 digits via strict regex patterns
     */
    private extractViaRegex(
        emailText: string,
        fromAddress: string
    ): CardDetectionResult | null {
        // Patterns for different banks
        const patterns: Record<string, RegExp[]> = {
            'HDFC': [
                /card ending in (\d{4})/i,
                /card (?:number |XXXX)?(\d{4})/i,
                /(\d{4})\s+(?:has been charged|was charged|spent)/i,
                /card \*{4}(\d{4})/i,
                /ending : (\d{4})/i
            ],
            'ICICI': [
                /card \*+(\d{4})/i,
                /card ending (\d{4})/i,
                /credit.*?(\d{4})/i,
                /(\d{4})\s+(?:debited|charged|spent)/i,
                /acct XX(\d{4})/i
            ],
            'AXIS': [
                /ending (\d{4})/i,
                /(\d{4})\s+(?:has been charged|was charged)/i,
                /card \*+(\d{4})/i,
                /card no.*?(\d{4})/i
            ],
            'SBI': [
                /card ending in (\d{4})/i,
                /(\d{4})\s+(?:charged|debited)/i,
                /ending with (\d{4})/i
            ],
            'AMEX': [
                /card ending (\d{5})/i, // Amex uses 5 sometimes? No, standard display is often last 5 in some regions, but let's stick to 4 if user asked for 4. User asked for 4. 
                /card ending (\d{4})/i
            ]
        };

        // Identify bank from sender
        const bank = this.identifyBank(fromAddress);
        // If bank identified, define specific patterns + generic
        // If not, just generic.

        let applicablePatterns = [
            /(?:card|credit).*?(\d{4})/i,
            /(\d{4})\s+(?:charged|spent|debited)/i,
            /ending (?:in|with)?\s*(\d{4})/i
        ];

        if (bank && patterns[bank]) {
            applicablePatterns = [...patterns[bank], ...applicablePatterns];
        }

        for (const pattern of applicablePatterns) {
            const match = emailText.match(pattern);
            if (match && match[1]) {
                const last4 = match[1];

                // Validate: must be exactly 4 digits and not all same (1111, 2222 = invalid)
                if (/^\d{4}$/.test(last4) && !/^(\d)\1{3}$/.test(last4)) {
                    return {
                        last4Digits: last4,
                        bankName: bank || 'Unknown',
                        confidence: bank ? 0.90 : 0.60,
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
     * Fuzzy match extracted last4 against user's existing cards
     * Prevents duplicate card entries
     */
    private async fuzzyMatchExistingCard(
        userId: string,
        extractedLast4: string,
        bankName?: string
    ): Promise<{ cardName?: string; confidence: number } | null> {
        // Get all user's cards
        const cards = await pool.query(
            `SELECT id, card_name, card_number_last4, bank_name FROM credit_cards 
       WHERE user_id = $1 AND is_active = TRUE`,
            [userId]
        );

        // EXACT match on last4 + bank
        const exactMatch = cards.rows.find(
            (card: any) => card.card_number_last4 === extractedLast4 &&
                (!bankName || (card.bank_name && bankName && card.bank_name.toLowerCase().includes(bankName.toLowerCase())))
        );

        if (exactMatch) {
            return {
                cardName: exactMatch.card_name,
                confidence: 0.95
            };
        }

        // Match on last4 only (if bank is unknown or slightly different)
        const last4Matches = cards.rows.filter((card: any) => card.card_number_last4 === extractedLast4);

        if (last4Matches.length === 1) {
            // High confidence if only one card has this last4
            return {
                cardName: last4Matches[0].card_name,
                confidence: 0.85
            };
        }

        // If multiple cards from same bank, require exact match
        const sameBank = cards.rows.filter(
            (card: any) => card.bank_name === bankName && card.card_number_last4 !== extractedLast4
        );

        if (sameBank.length > 0 && !exactMatch) {
            // Ambiguous: user has multiple cards from same bank
            // Return null to trigger manual mapping
            return null;
        }

        return null;
    }

    /**
     * Identify bank from email sender domain
     */
    private identifyBank(fromAddress: string): string | null {
        const bankDomains: Record<string, string> = {
            'hdfcbank': 'HDFC',
            'icici': 'ICICI',
            'axisbank': 'AXIS',
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
