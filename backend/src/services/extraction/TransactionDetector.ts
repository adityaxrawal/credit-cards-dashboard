import * as crypto from 'crypto';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

/**
 * Extracted transaction from email
 * @interface ExtractedTransaction
 */
export interface ExtractedTransaction {
    messageId: string;
    userId: string;
    amount: number;
    currency: 'INR';
    merchant: string;
    date: string;
    confidence: number;
    bank: string;
    cardLast4Digit: string;
    category?: string;
    detectionMethod: 'rule_based' | 'fuzzy' | 'gpt' | 'manual';
    evidence: {
        amountMatch: string;
        merchantMatch: string;
        dateMatch: string;
        cardMatch: string;
        bank: string;
    };
    needsReview: boolean;
    extractionError?: string;
    txnFingerprint: string;
}

export interface BankPattern {
    name: string;
    senderPattern: RegExp;
    transactionKeywords: RegExp;
    nonTransactionKeywords: RegExp;
    amountPattern: RegExp;
    merchantPattern: RegExp;
    datePattern: RegExp;
    cardPattern: RegExp;
    currencySymbol: string;
}

export const BANK_PATTERNS: BankPattern[] = [
    {
        name: 'HDFC',
        senderPattern: /hdfc.*bank|hdfcbank|instaalerts@hdfcbank/i,
        transactionKeywords: /(?:debited|spent|charged|transaction|txn|debit|credited)/i,
        nonTransactionKeywords: /(?:query|registered|offer|update|balance|deposit|alert|loan|voucher|lounge|upgrade|email|payee|job|career)/i,
        amountPattern: /Rs\.?\s*([0-9,]+(?:\.[0-9]{2})?)/i,
        merchantPattern: /(?:at|towards)\s+([A-Za-z0-9][A-Za-z0-9\s&*/-]+?)(?:[.,]?\s+(?:on|at|towards)|[.,]?$)/i,
        datePattern: /(?:on|at)\s+(\d{1,2}\s+\w+,?\s+\d{4}|\d{1,2}-\w+-\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i,
        cardPattern: /(?:card\s+ending|ending\s|Credit Card\s+ending\s|XX)(\d{4})/i,
        currencySymbol: 'Rs',
    },
    {
        name: 'SBI',
        senderPattern: /sbi.*card|sbicard|onlinesbicard/i,
        transactionKeywords: /(?:spent|transaction|debited|alert|charged)/i,
        nonTransactionKeywords: /(?:query|registered|offer|update|balance|deposit|alert|loan|voucher|lounge|upgrade|email|payee|job|career|password)/i,
        amountPattern: /(?:INR|Rs\.?)\s*([0-9,]+(?:\.[0-9]{2})?)/i,
        merchantPattern: /(?:at|towards)\s+([A-Za-z0-9][A-Za-z0-9\s&*/-]+?)(?:[.,]?\s+(?:on|at|towards)|[.,]?$)/i,
        datePattern: /(?:on|at)\s+(\d{1,2}\s+\w+,?\s+\d{4}|\d{1,2}-\w+-\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i,
        cardPattern: /(?:card\s+ending|ending\s|Credit Card\s+ending\s|XX)(\d{4})/i,
        currencySymbol: 'Rs',
    },
    {
        name: 'Axis',
        senderPattern: /axis.*bank|axisbank/i,
        transactionKeywords: /(?:spent|transaction|alert|OTP|for INR)/i,
        nonTransactionKeywords: /(?:query|registered|offer|update|balance|deposit|alert|loan|voucher|lounge|upgrade|email|payee|job|career|password)/i,
        amountPattern: /INR\s*([0-9,]+(?:\.[0-9]{2})?)/i,
        merchantPattern: /(?:at|towards)\s+([A-Za-z0-9][A-Za-z0-9\s&*/-]+?)(?:[.,]?\s+(?:on|at|towards)|[.,]?$)/i,
        datePattern: /(?:on|at)\s+(\d{1,2}\s+\w+,?\s+\d{4}|\d{1,2}-\w+-\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i,
        cardPattern: /(?:card\s+ending|ending\s|Credit Card\s+ending\s|XX)(\d{4})/i,
        currencySymbol: 'INR',
    },
    {
        name: 'IDFC',
        senderPattern: /idfc.*first.*bank/i,
        transactionKeywords: /(?:spent|debited|transaction|alert)/i,
        nonTransactionKeywords: /(?:query|registered|offer|update|balance|deposit|alert|loan|voucher|lounge|upgrade|email|payee|job|career|password)/i,
        amountPattern: /INR\s*([0-9,]+(?:\.[0-9]{2})?)/i,
        merchantPattern: /(?:at|towards)\s+([A-Za-z0-9][A-Za-z0-9\s&*/-]+?)(?:[.,]?\s+(?:on|at|towards)|[.,]?$)/i,
        datePattern: /(?:on|at)\s+(\d{1,2}\s+\w+,?\s+\d{4}|\d{1,2}-\w+-\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i,
        cardPattern: /(?:card\s+ending|ending\s|Credit Card\s+ending\s|XX)(\d{4})/i,
        currencySymbol: 'INR',
    },
    {
        name: 'YES',
        senderPattern: /yes.*bank/i,
        transactionKeywords: /(?:spent|transaction|alert|debit)/i,
        nonTransactionKeywords: /(?:query|registered|offer|update|balance|deposit|alert|loan|voucher|lounge|upgrade|email|payee|job|career|password)/i,
        amountPattern: /Rs\.?\s*([0-9,]+(?:\.[0-9]{2})?)/i,
        merchantPattern: /(?:at|towards)\s+([A-Za-z0-9][A-Za-z0-9\s&*/-]+?)(?:[.,]?\s+(?:on|at|towards)|[.,]?$)/i,
        datePattern: /(?:on|at)\s+(\d{1,2}\s+\w+,?\s+\d{4}|\d{1,2}-\w+-\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i,
        cardPattern: /(?:card\s+ending|ending\s|Credit Card\s+ending\s|XX)(\d{4})/i,
        currencySymbol: 'Rs',
    }
];

export interface TransactionDetectionResult {
    isTransaction: boolean;
    confidence: number;
    reason?: string;
    bank?: string;
}

export class TransactionDetector {

    /**
     * Stage 1: Hard Terminator Check
     */
    public isTerminator(subject: string, sender: string, content: string): boolean {
        const HARD_TERMINATORS = [
            'query has been registered',
            'query reference',
            'one time password',
            'otp for',
            'otp valid',
            'registered as your',
            'password updated',
            'email id updated'
        ];

        // Check if ANY hard terminator is found in subject or content
        const combined = (subject + ' ' + content).toLowerCase();
        return HARD_TERMINATORS.some(term => combined.includes(term));
    }

    /**
     * Stage 2: Bank Identification
     */
    public identifyBank(sender: string): string | null {
        const match = BANK_PATTERNS.find(p => p.senderPattern.test(sender));
        return match ? match.name : null;
    }

    /**
     * Check if email is likely a bank statement
     */
    public isBankStatement(sender: string, subject: string, bodySnippet: string): boolean {
        // 1. Must be from a known bank
        const bankName = this.identifyBank(sender);
        if (!bankName) return false;

        // 2. Look for explicit statement keywords in Subject or Body
        const STATEMENT_KEYWORDS = [
            /statement/i,
            /account\s+summary/i,
            /transaction\s+history/i,
            /consolidated/i,
            /e-?statement/i
        ];

        const textToCheck = (subject + ' ' + bodySnippet).toLowerCase();

        return STATEMENT_KEYWORDS.some(pattern => pattern.test(textToCheck));
    }

    /**
     * Stage 3: Keyword Analysis
     */
    public analyzeKeywords(content: string, pattern: BankPattern): number {
        const hasTransactionKeywords = pattern.transactionKeywords.test(content);
        const hasNonTransactionKeywords = pattern.nonTransactionKeywords.test(content);

        // Scoring logic
        if (hasNonTransactionKeywords) return 0.0; // Strong signal it's NOT a transaction (or low quality)
        if (hasTransactionKeywords) return 0.5; // Starts at 0.5 base
        return 0.2; // Weak signal
    }

    /**
     * Stage 4: Field Extraction Confidence
     */
    public calculateConfidence(
        baseScore: number,
        amount: boolean,
        merchant: boolean,
        date: boolean,
        card: boolean
    ): number {
        let confidence = baseScore;
        if (amount) confidence += 0.25;    // Critical field
        if (merchant) confidence += 0.10;
        if (date) confidence += 0.10;
        if (card) confidence += 0.10;

        // Bonus: All critical fields (amount + merchant + card) - actually amount + merchant + card is very strong
        if (amount && merchant && card) {
            // Check if current confidence < 0.95, if so boost it.
            // Base 0.5 + 0.25 + 0.1 + 0.1 = 0.95. 
            // If date is missing, it's 0.85, so boost might apply?
            // The requirement says: "if (amount && merchant && card) confidence = 0.95;"
            confidence = Math.max(confidence, 0.95);
        }

        return Math.min(confidence, 1.0);
    }

    /**
     * Main Public Method: Extract Transaction
     */
    public extractTransaction(
        messageId: string,
        userId: string,
        subject: string,
        sender: string,
        snippet: string,
        internalDate: number,
        fullContent?: string
    ): ExtractedTransaction | null {
        const content = (fullContent || snippet || '').trim();

        // 1. Stage 1: Terminator
        if (this.isTerminator(subject, sender, content)) {
            return null;
        }

        // 2. Stage 2: Identify Bank
        const bankName = this.identifyBank(sender);
        if (!bankName) {
            // If we can't identify the bank from sender, we can't apply rules reliably
            return null;
        }

        const pattern = BANK_PATTERNS.find(p => p.name === bankName)!;

        // 3. Stage 3: Keyword Analysis
        // We only proceed if it looks somewhat like a transaction
        // If analyzeKeywords returns 0, likely non-transaction
        const keywordScore = this.analyzeKeywords(content, pattern);
        // If keyword score is 0 due to non-transaction keywords, we might still check fields to be sure, 
        // or return null. The specs say "Terminator or non-transaction keywords" -> we handled terminator.
        // Let's rely on field extraction to validiate further, but if score is super low (e.g. 0 from keywords), maybe abort?
        // Requirement says: "Stage 3: Keyword Analysis (Confidence: 0.2-0.5)"
        // It doesn't explicitly say "Abort if 0", but Stage 4 adds to it.
        // If keyword analysis finds "nonTransactionKeywords", it usually implies we should stop or mark low confidence.
        // However, let's proceed to extract fields to see if we get a high confidence match anyway (e.g. "Payment to merchant" might trigger "payment" keyword which might be ambiguous).

        // 4. Extraction
        const amountMatch = this.extractAmount(content, pattern);
        const merchantMatch = this.extractMerchant(content, pattern);
        const dateMatch = this.extractDate(content, pattern);
        const cardMatch = this.extractCard(content, pattern);

        // Logic: calculate confidence
        // Note: The logic in requirements says "Stage 4: Field Extraction (Confidence: 0.5-1.0)"
        // It seems the base confidence comes from Stage 3/4 interaction. 
        // "calculateConfidence" function in specs starts with 0.5.
        // So let's use keywordScore as the base.

        const confidence = this.calculateConfidence(
            keywordScore,
            !!amountMatch,
            !!merchantMatch,
            !!dateMatch,
            !!cardMatch
        );

        // If confidence is very low, return null or return low-confidence txn?
        // "If !isTransaction -> Add to terminated"
        // We need to return the object so the caller can decide to terminate or review.
        // BUT, if confidence is < 0.2 (e.g. no fields found), maybe return null?
        // Let's return the object if we found AT LEAST ONE critical field (Amount) or confidence > threshold.
        // If no amount found, it's rarely a valid financial txn extraction.
        if (!amountMatch && confidence < 0.6) {
            return null;
        }

        // If confidence is super low (e.g. offer email), return null to terminate early
        if (confidence < 0.4) {
            return null;
        }

        const amount = amountMatch ? parseFloat(amountMatch.replace(/,/g, '')) : 0;
        const finalDate = dateMatch ? this.parseDate(dateMatch) : new Date(internalDate).toISOString().split('T')[0];
        const merchant = merchantMatch ? this.cleanMerchant(merchantMatch) : 'UNKNOWN';
        const cardLast4 = cardMatch || '0000';

        const fingerprint = this.generateFingerprint(amount, merchant, finalDate, cardLast4);

        const needsReview = confidence < 0.75; // >= 0.75 is Auto-save

        return {
            messageId,
            userId,
            amount,
            currency: 'INR',
            merchant,
            date: finalDate,
            confidence,
            bank: bankName,
            cardLast4Digit: cardLast4,
            category: this.categorizeTransaction(merchant),
            detectionMethod: 'rule_based',
            evidence: {
                amountMatch: amountMatch || '',
                merchantMatch: merchantMatch || '',
                dateMatch: dateMatch || '',
                cardMatch: cardMatch || '',
                bank: bankName
            },
            needsReview,
            txnFingerprint: fingerprint
        };
    }

    // --- Helper Extraction Methods ---

    private extractAmount(content: string, pattern: BankPattern): string | null {
        const match = content.match(pattern.amountPattern);
        return match ? match[1] : null;
    }

    private extractMerchant(content: string, pattern: BankPattern): string | null {
        const match = content.match(pattern.merchantPattern);
        return match ? match[1] : null;
    }

    private extractDate(content: string, pattern: BankPattern): string | null {
        const match = content.match(pattern.datePattern);
        return match ? match[1] : null;
    }

    private extractCard(content: string, pattern: BankPattern): string | null {
        const match = content.match(pattern.cardPattern);
        return match ? match[1] : match ? match[0] : null; // Logic in match might vary
    }

    // --- Utilities ---

    public parseDate(dateStr: string): string {
        // Formats: "17 Sep 2025", "17-Sep-2025", "17/09/2025", "17-09-2025"
        const formats = [
            'D MMM YYYY', 'DD MMM YYYY',
            'D-MMM-YYYY', 'DD-MMM-YYYY',
            'D/M/YYYY', 'DD/MM/YYYY',
            'D-M-YYYY', 'DD-MM-YYYY'
        ];

        let parsed = dayjs(dateStr, formats, true); // strict parsing
        if (!parsed.isValid()) {
            // Try loose parsing
            parsed = dayjs(dateStr);
        }

        if (parsed.isValid()) {
            return parsed.format('YYYY-MM-DD');
        }
        return dateStr; // Fallback? Or fail?
    }

    public cleanMerchant(merchant: string): string {
        return merchant
            .toUpperCase()
            .trim()
            .replace(/[^A-Z0-9\s*-]/g, '') // Remove special chars, removed & to match spec/test?
            .replace(/\s+/g, ' ')
            .substring(0, 100);
    }

    public categorizeTransaction(merchant: string): string {
        const m = merchant.toLowerCase();

        if (m.match(/swiggy|zomato|uber eats|food|restaurant|cafe|pizza|burger/)) return 'Food & Dining';
        if (m.match(/uber|ola|indigo|airline|flight|hotel|booking|travel|yulu/)) return 'Travel';
        if (m.match(/amazon|flipkart|myntra|meesho|shop|retail|mall/)) return 'Shopping';
        if (m.match(/netflix|prime|spotify|youtube|cred|dream/)) return 'Entertainment';
        if (m.match(/grocery|supermarket|zepto|blinkit|reliance|fresh|urban/)) return 'Groceries';
        if (m.match(/hospital|pharmacy|doctor|health|medical|clinic/)) return 'Health';
        if (m.match(/linkedin|insurance|mutual|investment|stocks/)) return 'Finance';

        return 'Shopping'; // Default
    }

    /**
     * Extract multiple transactions from a Statement Text (PDF content)
     */
    public extractFromStatement(
        text: string,
        bankName: string,
        defaultDate: string
    ): Partial<ExtractedTransaction>[] {
        const lines = text.split('\n');
        const transactions: Partial<ExtractedTransaction>[] = [];

        // Simple Heuristic for Statement Lines:
        // DATE ... DESCRIPTION ... AMOUNT
        // Regex to find a date at start, and a number at end (or near end)

        // Date formats: DD/MM/YYYY, DD-MMM-YYYY, DD MMM
        const dateStartRegex = /^(\d{1,2}[-\/\s](?:\w{3}|\d{1,2})[-\/\s]?\d{2,4})/;
        // Amount: 1,234.56 or 1234.56. (Dr/Cr suffix optional)
        const amountRegex = /([\d,]+\.\d{2})(?:\s*(?:Cr|Dr))?$/i;

        for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            // 1. Check for Date
            const dateMatch = cleanLine.match(dateStartRegex);
            if (!dateMatch) continue;

            const rawDate = dateMatch[1];

            // 2. Check for Amount
            const amountMatch = cleanLine.match(amountRegex);
            if (!amountMatch) continue;

            let amount = parseFloat(amountMatch[1].replace(/,/g, ''));
            if (isNaN(amount) || amount === 0) continue;

            // 3. Extract Description (Text between Date and Amount)
            // Remove Date from start
            let description = cleanLine.substring(rawDate.length).trim();
            // Remove Amount from end
            const lastIndex = description.lastIndexOf(amountMatch[0]); // Be careful if amount appears in desc
            // Simpler: just remove the amount match string from the end of description if it matches
            if (description.endsWith(amountMatch[0])) {
                description = description.substring(0, description.length - amountMatch[0].length).trim();
            } else if (amountMatch.index && amountMatch.index > rawDate.length) {
                // If regex matched at specific index in original line
                // This is hard to map back to substring logic perfectly without more complex parsing
                // Let's rely on removal from end or regex replace
                description = description.replace(amountMatch[0], '').trim();
            }

            // Cleanup description
            description = description.replace(/\s*(?:Cr|Dr)$/i, '').trim();
            description = this.cleanMerchant(description);

            if (description.length < 3) continue; // too short

            const date = this.parseDate(rawDate);

            // Construct Transaction
            // Note: We might miss some fields like Card Number if not on every line.
            transactions.push({
                amount,
                date: date || defaultDate,
                merchant: description,
                bank: bankName,
                currency: 'INR',
                category: this.categorizeTransaction(description),
                detectionMethod: 'rule_based',
                confidence: 0.9, // High confidence for statement lines
                needsReview: false,
                evidence: {
                    amountMatch: amount.toString(),
                    merchantMatch: description,
                    dateMatch: rawDate,
                    cardMatch: '',
                    bank: bankName
                }
            });
        }

        return transactions;
    }

    public generateFingerprint(amount: number, merchant: string, date: string, cardLast4: string): string {
        const raw = `${amount.toFixed(2)}|${merchant.toUpperCase()}|${date}|${cardLast4}`;
        return crypto.createHash('sha256').update(raw).digest('hex');
    }
}
