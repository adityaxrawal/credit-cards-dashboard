import { EnhancedRuleClassifier } from '../classification/EnhancedRuleClassifier';
import { CurrencyNormalizer } from '../../../utils/text/CurrencyNormalizer';

export interface DetectionResult {
    isFinancial: boolean;
    score: number;
    reasons: string[];
}

export class BroadFinancialDetector {
    /**
     * Determine if email represents any financial activity
     * High precision, rejects noise: marketing, OTPs, newsletters
     * 
     * NEW: Uses Scoring System (0-100)
     * Passing Score: >= 50
     */
    static isFinancialEmail(text: string): boolean {
        return this.detect(text).isFinancial;
    }

    /**
     * Comprehensive Detection with Scoring
     */
    static detect(text: string): DetectionResult {
        const lowerText = text.toLowerCase();
        let score = 0;
        const reasons: string[] = [];

        // 1. AMOUNT PRESENCE (Critical Signal) (+30 points)
        // Check for specific currency symbols or clear amount patterns
        const amountCandidates = CurrencyNormalizer.extractCandidates(text);
        if (amountCandidates.length > 0) {
            score += 30;
            reasons.push('Amount Detected');
        }

        // 2. TRANSACTION VERBS (Strong Signal) (+20 points)
        const verbs = /spent|purchase[d]?|bought|charged|debited|payment|paid|deducted|credited|received|deposited|refund|withdrawal|transfer|sent/i;
        if (verbs.test(lowerText)) {
            score += 20;
            reasons.push('Transaction Verb');
        }

        // 3. FINANCIAL ACCOUNT/INSTRUMENT (+20 points)
        const instruments = /credit\s+card|debit\s+card|bank\s+account|savings\s+a\/c|current\s+a\/c|rupay|visa|mastercard|amex|upi|neft|rtgs|imps|wallet/i;
        if (instruments.test(lowerText)) {
            score += 20;
            reasons.push('Instrument Keyword');
        }

        // 4. TRANSACTION ID / REF NO (+15 points)
        const refIds = /txn|ref(?:erence)?\s*(?:no|id)|payment\s+id|transaction\s+id/i;
        if (refIds.test(lowerText)) {
            score += 15;
            reasons.push('Reference ID');
        }

        // 5. BALANCE/STATEMENT CONTEXT (+10 points)
        const context = /avail\.\s+bal|available\s+balance|outstanding|bill\s+due|statement\s+for/i;
        if (context.test(lowerText)) {
            score += 10;
            reasons.push('Balance/Statement Context');
        }

        // --- RECEIPT / ACKNOWLEDGMENT PENALTY ---
        // "We have received your payment" is usually a merchant/insurer receipt, not a bank debit.
        // We want to track the BANK debit, not the merchant receipt.
        const acknowledgment = /received\s+your\s+payment|payment\s+received|acknowledgement/i;
        if (acknowledgment.test(lowerText)) {
            // But be careful: "Payment received" on a Credit Card statement IS a transaction (repayment).
            // So we check if "credit card" or "account" is mentioned nearby? 
            // BroadDetector is heuristic. Let's penalize, and rely on "Instrument Keyword" to boost it back up if it's a bank.
            score -= 25;
            reasons.push('Acknowledgment Penalty');
        }

        // 6. BANK SENDER / BRANDING (We verify sender in Classifier, but text might have it)
        // Hard to detect generically without list, skip for now or rely on pattern matching

        // --- NEGATIVE EVIDENCE RULES (Strong Filter) ---
        // Words that strongly suggest this is NOT a transaction
        const negativeSignals = /offer\s+valid|voucher|pre[- ]?approved|upgrade\s+program|newsletter|digest|market\s+highlights|upcoming\s+bill|generated\s+on|check\s+eligibility|book\s+now|register(?!\s+for\s+banking)|apply\s+now/i;

        // --- STRONG TRANSACTION CONFIRMATION ---
        // Words that confirm money MOVED (to override negative signals)
        const strongConfirmation = /debited|credited|payment\s+successful|txn\s+id|ref\s+no|transaction\s+id|authorization\s+code/i;

        const hasNegative = negativeSignals.test(lowerText);
        const hasConfirmation = strongConfirmation.test(lowerText);

        if (hasNegative && !hasConfirmation) {
            score -= 50;
            reasons.push('Negative Signal Detected');
        }

        // --- PROMOTIONAL PENALTIES ---
        // If it looks like marketing, we deduct heavily unless strong financial signals exist
        const marketing = /marketing|promotional|discount\s+(?:offer|code)|coupon|limited\s+offer|enjoy\s+benefits|exclusive\s+privilege/i;
        if (marketing.test(lowerText)) {
            if (!hasConfirmation) {
                // If no EXPLICIT transaction confirmation, penalize heavily even if amount exists
                // (e.g. "Get ₹500 voucher" is NOT a transaction)
                score -= 40;
                reasons.push('Marketing Penalty');
            } else {
                // Real transaction but maybe with a coupon mentioned
                score -= 5;
                reasons.push('Minor Marketing Noise');
            }
        }

        // OTP / SECURITY PENALTY
        // We typically exclude these unless they are "Transaction OTPs" which might be relevant (but usually we want confirmed txns)
        // For now, penalize OTPs as we want only FINAL transactions
        const otp = /otp|verification\s+code|one[- ]?time\s+password|login\s+alert/i;
        if (otp.test(lowerText)) {
            score -= 50;
            reasons.push('OTP/Security Penalty');
        }

        // PASSING THRESHOLD
        // Default: 50
        const THRESHOLD = 50;
        const isFinancial = score >= THRESHOLD;

        return {
            isFinancial,
            score,
            reasons
        };
    }
}
