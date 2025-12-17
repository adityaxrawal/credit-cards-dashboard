import { CleanEmailContent } from '../sanitize/sanitizer';

export interface FilterResult {
    shouldProcess: boolean;
    reason: string;
    category: string;
}

export class FilterService {
    private static readonly SENDER_DOMAINS = [
        ".bank.in", "hdfcbank.com", "hdfcbank.net", "sbi.co.in", "sbicard.com",
        "icicibank.com", "icicibank.in", "axisbank.com", "axisbank.co.in",
        "idfcfirstbank.com", "indusind.com", "indusindbank.in", "citibank.com", "citi.com",
        "americanexpress.com", "aexp.com", "hsbc.co.in", "kotak.com", "kotak.in",
        "rblbank.com", "sc.com", "in.sc.com", "yesbank.in", "federalbank.co.in", "federalbank.in",
        "aubank.in", "bankofbaroda.com", "bankofbaroda.in", "canarabank.in",
        "pnbindia.in", "pnb.co.in", "unionbankofindia.co.in", "bankofindia.co.in",
        "idbibank.in", "dbs.com"
    ];

    /**
     * Filter: Returns TRUE if email should pass to Rule Processing.
     * FALSE if it should be discarded (promotional, otp, etc.)
     */
    static filter(email: CleanEmailContent): FilterResult {
        // 1. Check Sender (Loose filter, mostly for logging context, not hard block yet?)
        // Actually, prompt says "Filters must remove...". It doesn't explicitly say "Remove non-bank senders",
        // but the Detect logic had it.
        // "Any non-credit-card spend".

        const combined = (email.subject + ' ' + email.cleanedBody).toUpperCase();

        // 2. OTP / 2FA
        if (this.isOtp(combined)) {
            return { shouldProcess: false, reason: 'OTP/2FA Detected', category: 'OTP' };
        }

        // 3. Payment Success / Bill Pay (Not a spend)
        if (this.isPaymentSuccess(combined)) {
            return { shouldProcess: false, reason: 'Bill Payment Confirmation', category: 'PAYMENT_SUCCESS' };
        }

        // 4. Promotions
        if (this.isPromotional(combined) && !this.hasTransactionKeywords(combined)) {
            // Only block if strictly promo and NO transaction keywords
            return { shouldProcess: false, reason: 'Promotional Content', category: 'PROMO' };
        }

        // 5. Account Alerts
        if (this.isAlert(combined)) {
            return { shouldProcess: false, reason: 'Account Alert', category: 'ALERT' };
        }

        // 6. Statements (PDFs handled separately? No, prompt says "Fetch raw... -> Sanitize -> Filter".
        // "Filters must remove...".
        // If it's a statement, do we process it?
        // Old logic: "isStatementPdf return false".
        // BUT extraction service had `processPdfStatement`.
        // The PROMPT says: "Filters must remove... Any non-credit-card spend".
        // Statements CONTAIN spends.
        // However, the rule processor usually parses *individual* transaction emails.
        // Logic collision: If we filter out statements, we lose bulk imports.
        // But the prompt says "Process 20 mails in parallel... Regex, templates...".
        // And "Output: PASS (insert) or FAIL (GPT)".
        // A statement email effectively FAILS rule based single transaction regex.
        // If I filter it OUT, it's gone.
        // If I let it PASS, it goes to Rules. Rules might fail -> GPT.
        // GPT cost for Statement PDF? Huge.
        // Decision: Explicitly SUPPORT Statement processing in Rules, OR filter them out if user only wants Real-Time Spends.
        // Prompt says "Gmail Sync Flow". Usually implies history.
        // "Filters must remove... Promotional...". It doesn't say remove Statements.
        // I will ALLOW Statements, but mark them.
        // Wait, the old `CreditCardMailDetector` returned `shouldProcess: false` for statements!
        // See line 90 of `creditCardMailDetector.ts`: `return { ... shouldProcess: false }`.
        // This implies the *old* system ignored statements during detection?
        // ERROR in my understanding?
        // Let's re-read `extraction.service.ts` line 188: `const isStatement = /statement/i.test(message.subject); ... if (!isStatement) parsed = parser.parse(...)`.
        // `extractTransactionFromEmail` calls `CreditCardMailDetector.detect`.
        // If detection returns false, it aborts.
        // So if `CreditCardMailDetector` returns false for Statement, then Statements were NEVER processed?
        // Line 84 in `creditCardMailDetector.ts`: `if (this.isStatementPdf(email)) ... shouldProcess: false`.
        // THIS MEANS STATEMENTS WERE IGNORED.
        // BUT `extraction.service.ts` has `processPdfStatement`.
        // This looks like dead/broken code in the old repo or I am misreading.

        // User Prompt: "Filters must remove: ... Non-transaction alerts ... Any non-credit-card spend".
        // "Only credit card spend transactions are allowed to pass".
        // I will interpret "Spend Transaction" as "Real-time transaction alert".
        // I will STRICTLY filter out Statements for now to match `CreditCardMailDetector` behavior, unless `processPdfStatement` was being called via some other path.
        // `extraction.service.ts` calls `detect()` at line 110. If `shouldProcess` is false, it returns `ignored`.
        // So `processPdfStatement` (line 409) was unreachable for emails identified as statements by the detector!
        // Unless the detector failed to identify it as a statement.
        // I will assume Statements should be FILTERED OUT based on strict "Spend Transaction" rule.
        // Re-enabling statements is a FEATURE, and prompt says "Do not introduce new features".

        if (this.isStatement(combined)) {
            return { shouldProcess: false, reason: 'Statement Email', category: 'STATEMENT' };
        }

        // 7. Positive Identification (Must look like a spend)
        // Only "Debit" or "Refund" or "Credit" (rewards).
        if (this.isTransaction(combined)) {
            return { shouldProcess: true, reason: 'Transaction Detected', category: 'TRANSACTION' };
        }

        return { shouldProcess: false, reason: 'No Transaction Pattern', category: 'UNKNOWN' };
    }

    // --- Private Helpers (Regex Helpers) ---

    private static isOtp(text: string): boolean {
        const patterns = [
            /\b(OTP|ONE[\s-]?TIME[\s-]?PASSWORD)\b/i,
            /\b(VERIFICATION|VERIFY)\s+CODE\b/i,
            /\b\d{4,6}\b.*?(valid|expires?|use)/i,
            /enter.*?\d{4,6}.*?to.*?(verify|confirm)/i
        ];
        return patterns.some(p => p.test(text));
    }

    private static isPaymentSuccess(text: string): boolean {
        const patterns = [
            /\b(PAYMENT|BILL)\s+(RECEIVED|SUCCESS|CONFIRMED)\b/i,
            /\b(PAYMENT|BILL)\s+OF\s+₹/i,
            /\byour.*?payment\s+(has been|was|is)\s+(received|processed|confirmed)/i,
            /\bthank you for (paying|clearing)/i
        ];
        return patterns.some(p => p.test(text));
    }

    private static isPromotional(text: string): boolean {
        const patterns = [
            /\b(OFFER|PROMOTION|PROMO|DISCOUNT|CASHBACK|REWARDS?)\b/i,
            /\blimit.*?time.*?(offer|deal)/i,
            /\bapply now|register|sign up/i,
            /\bpersonal loan\b/i
        ];
        return patterns.some(p => p.test(text));
    }

    private static hasTransactionKeywords(text: string): boolean {
        return /(?:charged|debited|spent|transaction|purchase)/i.test(text) && /₹|INR|Rs/i.test(text);
    }

    private static isAlert(text: string): boolean {
        const patterns = [
            /\blimit.*?(reached|exceeded|approaching)/i,
            /\b(security|fraud|suspicious)\b/i,
            /\b(unusual|abnormal)\s+activity\b/i,
            /\bcard.*?(activated|locked|blocked|disabled|closed)/i
        ];
        return patterns.some(p => p.test(text));
    }

    private static isStatement(text: string): boolean {
        // Strict statement check
        return /\b(STATEMENT|BILL STATEMENT)\b/i.test(text) || /\bstatement for.*?(january|february)/i.test(text);
    }

    private static isTransaction(text: string): boolean {
        // Must have amount AND keyword
        const amount = /(?:Rs|INR|₹)\s*[\d,]+/i;
        const debit = /\b(transaction|txn|purchase|spent|charged|swipe|debited)\b/i;
        const refund = /\b(refund|reversal|reversed)\b/i;

        // Also support "Credit" alerts (money added) if it's transaction related (refund/reward), 
        // but the prompt says "Only credit card spend transactions".
        // Spend = Debit.
        // Refunds = "Payment failures, Refunds" are LISTED IN "Filters must remove"??
        // WAIT.
        // Prompt: "Filters must remove: ... Refunds, Reversals ... Any non-credit-card spend".
        // "Only credit card **spend** transactions are allowed to pass".
        // My previous analysis of `CreditCardMailDetector` showed implementation of Refund/Credit support (lines 139, 149).
        // BUT the PROMPT explicitly says: "Filters must remove: ... Refunds ... Reversals".
        // THIS IS A CRITICAL CONTRADICTION or I must follow the PROMPT over the old code.
        // Source of Truth: "The attached flow diagram is the single source of truth... Everything... must map clearly".
        // Diagram Text (from prompt text): "Filters must remove: ... Refunds, Reversals ...".
        // OK, I must REMOVE Refunds and Reversals.
        // I must ONLY allow Spends.

        // So `isTransaction` must only pass DEBITS.

        if (refund.test(text)) return false; // Explicitly fail refunds

        return amount.test(text) && debit.test(text);
    }
}
