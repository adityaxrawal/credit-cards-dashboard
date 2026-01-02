import { InstrumentType } from '@shared/types/transaction.types';
import logger from '@shared/utils/infrastructure/logger';

/**
 * Detected instrument details from email content
 */
export interface DetectedInstrument {
    type: InstrumentType;
    cardLast4?: string;
    accountMasked?: string;
    upiVpa?: string;
    bankName?: string;
    confidence: number;
}

/**
 * InstrumentDetector - Extracts financial instrument details from email content
 * 
 * Detects:
 * - Card last 4 digits
 * - Masked account numbers
 * - UPI VPAs
 * - Bank names and IFSC codes
 */
export class InstrumentDetector {
    // Common bank name patterns
    private static readonly BANK_PATTERNS: Array<{ pattern: RegExp; bank: string }> = [
        { pattern: /hdfc\s+bank/i, bank: 'HDFC Bank' },
        { pattern: /icici\s+bank/i, bank: 'ICICI Bank' },
        { pattern: /sbi|state\s+bank/i, bank: 'SBI' },
        { pattern: /axis\s+bank/i, bank: 'Axis Bank' },
        { pattern: /kotak/i, bank: 'Kotak Mahindra Bank' },
        { pattern: /yes\s+bank/i, bank: 'Yes Bank' },
        { pattern: /idfc\s+first/i, bank: 'IDFC First Bank' },
        { pattern: /federal\s+bank/i, bank: 'Federal Bank' },
        { pattern: /indusind/i, bank: 'IndusInd Bank' },
        { pattern: /rbl\s+bank/i, bank: 'RBL Bank' },
        { pattern: /au\s+small\s+finance/i, bank: 'AU Small Finance Bank' },
        { pattern: /bob|bank\s+of\s+baroda/i, bank: 'Bank of Baroda' },
        { pattern: /pnb|punjab\s+national/i, bank: 'Punjab National Bank' },
        { pattern: /canara\s+bank/i, bank: 'Canara Bank' },
        { pattern: /union\s+bank/i, bank: 'Union Bank of India' },
        { pattern: /idbi\s+bank/i, bank: 'IDBI Bank' },
        { pattern: /citi\s*bank/i, bank: 'Citibank' },
        { pattern: /hsbc/i, bank: 'HSBC' },
        { pattern: /standard\s+chartered/i, bank: 'Standard Chartered' },
        { pattern: /amex|american\s+express/i, bank: 'American Express' },
        { pattern: /onecard/i, bank: 'OneCard' },
        { pattern: /jupiter/i, bank: 'Jupiter' },
        { pattern: /slice/i, bank: 'Slice' },
        { pattern: /fi\s+money|epifi/i, bank: 'Fi Money' },
        { pattern: /niyo/i, bank: 'Niyo' },
    ];

    // Card number patterns (last 4 or masked)
    private static readonly CARD_PATTERNS: RegExp[] = [
        /card\s+(?:ending|ending\s+with|no\.?|number)?\s*[:\s]*[X*]+(\d{4})/i,
        /card\s+[X*]+(\d{4})/i,
        /ending\s+(?:in\s+)?(\d{4})/i,
        /xx+(\d{4})/i,
        /\*{4,}(\d{4})/i,
        /credit\s+card\s+(\d{4})/i,
        /debit\s+card\s+(\d{4})/i,
    ];

    // Account number patterns (masked)
    private static readonly ACCOUNT_PATTERNS: RegExp[] = [
        /a\/c\s*(?:no\.?)?\s*[:\s]*[X*x]+(\d{3,6})/i,
        /account\s+(?:no\.?|number)?\s*[:\s]*[X*x]+(\d{3,6})/i,
        /account\s+[X*x]+(\d{3,6})/i,
        /savings\s+a\/c\s+[X*x]+(\d{3,6})/i,
        /current\s+a\/c\s+[X*x]+(\d{3,6})/i,
        /(?:from|to)\s+(?:your\s+)?(?:account|a\/c)\s+[X*]+(\d{3,6})/i,
    ];

    // UPI VPA patterns
    private static readonly UPI_PATTERNS: RegExp[] = [
        /(?:from|to|vpa|upi\s+id)[:\s]+([a-zA-Z0-9._-]+@[a-zA-Z]+)/i,
        /([a-zA-Z0-9._-]+@(?:upi|oksbi|okaxis|okicici|okhdfcbank|ybl|paytm|apl|ibl|axl|sbi|icici|hdfc|axis|kotak|yes|federal|bob))/i,
    ];

    /**
     * Detect all instruments from email content
     */
    static detectFromContent(
        subject: string,
        body: string,
        senderDomain?: string
    ): DetectedInstrument[] {
        const text = `${subject} ${body}`;
        const instruments: DetectedInstrument[] = [];

        // Detect card
        const card = this.detectCard(text);
        if (card) {
            instruments.push(card);
        }

        // Detect account
        const account = this.detectAccount(text);
        if (account) {
            instruments.push(account);
        }

        // Detect UPI
        const upi = this.detectUPI(text);
        if (upi) {
            instruments.push(upi);
        }

        // Try to enrich with bank name from sender domain
        if (senderDomain) {
            const bankFromDomain = this.detectBankFromDomain(senderDomain);
            for (const instrument of instruments) {
                if (!instrument.bankName && bankFromDomain) {
                    instrument.bankName = bankFromDomain;
                }
            }
        }

        // Try to find bank name in content
        const bankFromContent = this.detectBankFromContent(text);
        for (const instrument of instruments) {
            if (!instrument.bankName && bankFromContent) {
                instrument.bankName = bankFromContent;
            }
        }

        return instruments;
    }

    /**
     * Detect card details
     */
    private static detectCard(text: string): DetectedInstrument | null {
        for (const pattern of this.CARD_PATTERNS) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const last4 = match[1];
                // Determine if it's credit or debit card
                const isCreditCard = /credit\s+card/i.test(text);
                const isDebitCard = /debit\s+card/i.test(text);

                return {
                    type: isCreditCard ? InstrumentType.CREDIT_CARD :
                        isDebitCard ? InstrumentType.DEBIT_CARD :
                            InstrumentType.CREDIT_CARD, // Default to credit card
                    cardLast4: last4,
                    confidence: 0.9
                };
            }
        }
        return null;
    }

    /**
     * Detect account details
     */
    private static detectAccount(text: string): DetectedInstrument | null {
        for (const pattern of this.ACCOUNT_PATTERNS) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return {
                    type: InstrumentType.BANK_ACCOUNT,
                    accountMasked: `XXXX${match[1]}`,
                    confidence: 0.85
                };
            }
        }
        return null;
    }

    /**
     * Detect UPI VPA
     */
    private static detectUPI(text: string): DetectedInstrument | null {
        for (const pattern of this.UPI_PATTERNS) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return {
                    type: InstrumentType.UPI,
                    upiVpa: match[1].toLowerCase(),
                    confidence: 0.95
                };
            }
        }
        return null;
    }

    /**
     * Detect bank from sender domain
     */
    private static detectBankFromDomain(domain: string): string | null {
        const domainLower = domain.toLowerCase();

        const domainBankMap: Record<string, string> = {
            'hdfcbank.com': 'HDFC Bank',
            'icicibank.com': 'ICICI Bank',
            'sbi.co.in': 'SBI',
            'axisbank.com': 'Axis Bank',
            'kotak.com': 'Kotak Mahindra Bank',
            'yesbank.co.in': 'Yes Bank',
            'idfcfirstbank.com': 'IDFC First Bank',
            'federalbank.co.in': 'Federal Bank',
            'indusind.com': 'IndusInd Bank',
            'rblbank.com': 'RBL Bank',
            'aubank.in': 'AU Small Finance Bank',
            'citibank.com': 'Citibank',
            'hsbc.com': 'HSBC',
            'sc.com': 'Standard Chartered',
            'aexp.com': 'American Express',
            'onecard.com': 'OneCard',
            'jupiter.money': 'Jupiter',
            'sliceit.com': 'Slice',
            'fi.money': 'Fi Money',
        };

        for (const [key, bank] of Object.entries(domainBankMap)) {
            if (domainLower.includes(key)) {
                return bank;
            }
        }

        return null;
    }

    /**
     * Detect bank from content
     */
    private static detectBankFromContent(text: string): string | null {
        for (const { pattern, bank } of this.BANK_PATTERNS) {
            if (pattern.test(text)) {
                return bank;
            }
        }
        return null;
    }

    /**
     * Get the best instrument type based on transaction context
     */
    static inferInstrumentType(
        transactionType: string,
        detectedInstruments: DetectedInstrument[]
    ): InstrumentType {
        // If we detected instruments, use the highest confidence one
        if (detectedInstruments.length > 0) {
            const sorted = [...detectedInstruments].sort((a, b) => b.confidence - a.confidence);
            return sorted[0].type;
        }

        // Infer from transaction type
        const typeInference: Record<string, InstrumentType> = {
            'cc_spend': InstrumentType.CREDIT_CARD,
            'cc_upi': InstrumentType.CREDIT_CARD,
            'cc_payment': InstrumentType.BANK_ACCOUNT,
            'cc_reversal': InstrumentType.CREDIT_CARD,
            'bank_debit': InstrumentType.BANK_ACCOUNT,
            'bank_upi_debit': InstrumentType.UPI,
            'bank_credit': InstrumentType.BANK_ACCOUNT,
            'bank_upi_credit': InstrumentType.UPI,
            'salary': InstrumentType.BANK_ACCOUNT,
            'refund': InstrumentType.CREDIT_CARD,
            'investment': InstrumentType.BANK_ACCOUNT,
            'fee': InstrumentType.BANK_ACCOUNT,
            'bank_charge': InstrumentType.BANK_ACCOUNT,
            'interest_debit': InstrumentType.BANK_ACCOUNT,
            'interest_credit': InstrumentType.BANK_ACCOUNT,
            'cheque_deposit': InstrumentType.BANK_ACCOUNT,
            'cheque_return': InstrumentType.BANK_ACCOUNT,
            'atm_withdrawal': InstrumentType.DEBIT_CARD,
            'standing_instruction': InstrumentType.BANK_ACCOUNT,
            'enach': InstrumentType.BANK_ACCOUNT,
        };

        return typeInference[transactionType] || InstrumentType.BANK_ACCOUNT;
    }

    /**
     * Extract IFSC code if present
     */
    static extractIFSC(text: string): string | null {
        const ifscPattern = /(?:ifsc|ifsc\s+code)[:\s]*([A-Z]{4}0[A-Z0-9]{6})/i;
        const match = text.match(ifscPattern);
        return match ? match[1].toUpperCase() : null;
    }

    /**
     * Combine detected instruments into instrument_details JSON
     */
    static buildInstrumentDetails(
        instruments: DetectedInstrument[]
    ): Record<string, string | undefined> {
        const details: Record<string, string | undefined> = {};

        for (const inst of instruments) {
            if (inst.cardLast4) {
                details.card_last4 = inst.cardLast4;
            }
            if (inst.accountMasked) {
                details.account_masked = inst.accountMasked;
            }
            if (inst.upiVpa) {
                if (inst.type === InstrumentType.UPI) {
                    // Could be payer or payee based on direction
                    details.upi_vpa = inst.upiVpa;
                }
            }
            if (inst.bankName) {
                details.bank_name = inst.bankName;
            }
        }

        return details;
    }
}
