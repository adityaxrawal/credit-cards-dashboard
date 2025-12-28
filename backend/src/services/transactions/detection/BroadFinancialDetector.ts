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

        // 6. BANK SENDER / BRANDING (We verify sender in Classifier, but text might have it)
        // Hard to detect generically without list, skip for now or rely on pattern matching

        // --- PROMOTIONAL PENALTIES ---
        // If it looks like marketing, we deduct heavily unless strong financial signals exist
        const marketing = /marketing|promotional|discount\s+(?:offer|code)|coupon|limited\s+offer|apply\s+now|pre[- ]?approved/i;
        if (marketing.test(lowerText)) {
            // Apply penalty ONLY if we don't have an explicit amount
            if (amountCandidates.length === 0) {
                score -= 40;
                reasons.push('Marketing Penalty');
            } else {
                // If amount exists (e.g. "You spent 500. Get discount..."), we enforce simpler penalty
                score -= 10;
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
