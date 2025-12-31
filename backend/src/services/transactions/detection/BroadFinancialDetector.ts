import { EnhancedRuleClassifier } from '../classification/EnhancedRuleClassifier';
import { CurrencyNormalizer } from '../../../utils/text/CurrencyNormalizer';
import { isFinancialAuthority, isMerchantSender } from '../../../data/transaction-patterns';

export interface DetectionResult {
    isFinancial: boolean;
    score: number;
    reasons: string[];
}

export class BroadFinancialDetector {
    // PRECOMPILED REGEXES for performance (compiled once at class load)
    private static readonly VERBS_REGEX = /spent|purchase[d]?|bought|charged|debited|payment|paid|deducted|credited|received|deposited|refund|withdrawal|transfer|sent/i;
    private static readonly RECEIVING_EMAIL_REGEX = /receiving\s+this\s+email|received\s+this\s+email/i;
    private static readonly ALERT_PATTERN_REGEX = /transaction\s+(?:alert|notification|update)|alert\s+from\s+.*card/i;
    private static readonly INSTRUMENTS_REGEX = /credit\s+card|debit\s+card|bank\s+account|savings\s+a\/c|current\s+a\/c|rupay|visa|mastercard|amex|upi|neft|rtgs|imps|wallet/i;
    private static readonly REF_IDS_REGEX = /txn|ref(?:erence)?\s*(?:no|id)|payment\s+id|transaction\s+id/i;
    private static readonly CONTEXT_REGEX = /avail\.\s+bal|available\s+balance|outstanding|bill\s+due|statement\s+for/i;
    private static readonly ACKNOWLEDGMENT_REGEX = /received\s+your\s+payment|payment\s+received|acknowledgement/i;
    private static readonly NEGATIVE_SIGNALS_REGEX = /offer\s+valid|voucher|pre[- ]?approved|upgrade\s+program|newsletter|digest|market\s+highlights|upcoming\s+bill|generated\s+on|check\s+eligibility|book\s+now|register(?!\s+for\s+banking)|apply\s+now|webinar|certification|course|syllabus|training\s+session|masterclass|unsubscribe/i;
    private static readonly STRONG_CONFIRMATION_REGEX = /debited|credited|payment\s+successful|txn\s+id|ref\s+no|transaction\s+id|authorization\s+code|e-?mandate|registration\s+success|mandate\s+(?:set|registered|approved|cancelled)|debit\s+approval/i;
    private static readonly MARKETING_REGEX = /marketing|promotional|discount\s+(?:offer|code)|coupon|limited\s+offer|enjoy\s+benefits|exclusive\s+privilege/i;
    private static readonly OTP_REGEX = /otp|verification\s+code|one[- ]?time\s+password|login\s+alert/i;

    /**
     * Determine if email represents any financial activity
     * High precision, rejects noise: marketing, OTPs, newsletters
     * 
     * NEW: Uses Scoring System (0-100)
     * Passing Score: >= 50
     */
    static isFinancialEmail(text: string, sender?: string): boolean {
        return this.detect(text, sender).isFinancial;
    }

    /**
     * Comprehensive Detection with Scoring
     */
    static detect(text: string, sender?: string): DetectionResult {
        const lowerText = text.toLowerCase();
        let score = 0;
        const reasons: string[] = [];

        // 0. SENDER CHECK (The "Financial Authority" Gate)
        if (sender) {
            // A. REJECT MERCHANTS (Duplicate Prevention)
            const merchantCheck = isMerchantSender(sender);
            if (merchantCheck.isMerchant) {
                return {
                    isFinancial: false,
                    score: 0,
                    reasons: [`Merchant Rejection: ${merchantCheck.merchantName}`]
                };
            }

            // B. BOOST FINANCIAL AUTHORITIES
            const authCheck = isFinancialAuthority(sender);
            if (authCheck.isKnown) {
                // Massive boost: We trust banks.
                // But we still scour content to ensure it's not a Loan Offer or OTP.
                score += 40;
                reasons.push(`Verified Authority: ${authCheck.bankName}`);
            } else {
                // C. UNKNOWN SENDER PENALTY (reduced to prevent false rejections)
                // If it's not a known bank/wallet, we treat it with suspicion.
                // It needs strong signals (Verb + Amount + RefID) to pass.
                score -= 10;
                reasons.push('Unknown Sender Penalty');
            }
        }

        // 1. AMOUNT PRESENCE (Critical Signal) (+30 points)
        // Check for specific currency symbols or clear amount patterns
        const amountCandidates = CurrencyNormalizer.extractCandidates(text);
        if (amountCandidates.length > 0) {
            score += 30;
            reasons.push('Amount Detected');
        }

        // 2. TRANSACTION VERBS (Strong Signal) (+20 points)
        if (this.VERBS_REGEX.test(lowerText)) {
            // IGNORE "receiving this email" context
            if (!this.RECEIVING_EMAIL_REGEX.test(lowerText)) {
                score += 20;
                reasons.push('Transaction Verb');
            }
        }

        // 2a. TRANSACTION ALERTS (New Pattern) (+15 points)
        if (this.ALERT_PATTERN_REGEX.test(lowerText)) {
            score += 15;
            reasons.push('Transaction Alert Pattern');
        }

        // 3. FINANCIAL ACCOUNT/INSTRUMENT (+20 points)
        if (this.INSTRUMENTS_REGEX.test(lowerText)) {
            score += 20;
            reasons.push('Instrument Keyword');
        }

        // 4. TRANSACTION ID / REF NO (+15 points)
        if (this.REF_IDS_REGEX.test(lowerText)) {
            score += 15;
            reasons.push('Reference ID');
        }

        // 5. BALANCE/STATEMENT CONTEXT (+10 points)
        if (this.CONTEXT_REGEX.test(lowerText)) {
            score += 10;
            reasons.push('Balance/Statement Context');
        }

        // --- RECEIPT / ACKNOWLEDGMENT PENALTY ---
        if (this.ACKNOWLEDGMENT_REGEX.test(lowerText)) {
            score -= 25;
            reasons.push('Acknowledgment Penalty');
        }

        // 6. BANK SENDER / BRANDING (We verify sender in Classifier, but text might have it)
        // Hard to detect generically without list, skip for now or rely on pattern matching

        // --- NEGATIVE EVIDENCE RULES ---
        const hasNegative = this.NEGATIVE_SIGNALS_REGEX.test(lowerText);
        const hasConfirmation = this.STRONG_CONFIRMATION_REGEX.test(lowerText);

        if (hasNegative && !hasConfirmation) {
            score -= 30;
            reasons.push('Negative Signal Detected');
        }

        // --- PROMOTIONAL PENALTIES ---
        if (this.MARKETING_REGEX.test(lowerText)) {
            if (!hasConfirmation) {
                score -= 40;
                reasons.push('Marketing Penalty');
            } else {
                score -= 5;
                reasons.push('Minor Marketing Noise');
            }
        }

        // OTP / SECURITY PENALTY
        if (this.OTP_REGEX.test(lowerText)) {
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
