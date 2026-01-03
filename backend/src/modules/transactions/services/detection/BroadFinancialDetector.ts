/**
 * BroadFinancialDetector - New Architecture Transaction Detection
 * 
 * COMPLETE REWRITE as per new specification:
 * - Detects ONLY completed monetary transaction events
 * - Strict validation against predefined criteria
 * - Rejects non-transactions (OTPs, marketing, pending, failed)
 * - Integrates with confidence scoring system
 */

import { CurrencyNormalizer } from '@shared/utils/text/CurrencyNormalizer';
import { isFinancialAuthority, isMerchantSender } from '../../../../data/transaction-patterns';
import { ConfidenceScorer, SignalDetection } from '../scoring/ConfidenceScorer';
import { ConfidenceDetails, ManualReviewReason, ManualReviewTrigger, SourceType } from '@shared/types/transaction.types';
import * as crypto from 'crypto';

// ============================================
// Detection Result Interfaces (New Architecture)
// ============================================

export interface DetectionResult {
    isFinancial: boolean;
    score: number;
    reasons: string[];
}

export interface StrictDetectionResult {
    isValidTransaction: boolean;
    failureReasons: string[];
    confidenceScore: number;
    confidenceDetails: ConfidenceDetails;
    requiresManualReview: boolean;
    reviewTriggers: ManualReviewTrigger[];
    sourceType?: SourceType;
    detectedSignals: SignalDetection;
}

export interface AuthorityCheckResult {
    isAuthoritative: boolean;
    sourceType?: SourceType;
    bankName?: string;
    isMerchant: boolean;
    merchantName?: string;
}

// ============================================
// Regex Pattern Definitions (New Architecture)
// ============================================

const PATTERNS = {
    // === POSITIVE SIGNALS: Completed Transaction Indicators ===
    COMPLETION_SUCCESS: /\b(?:debited|credited|successful(?:ly)?|completed|confirmed|processed|posted)\b/i,
    COMPLETION_VERBS: /\b(?:spent|charged|paid|deducted|received|deposited|withdrawn|transferred|sent)\b/i,
    ALERT_PATTERNS: /\b(?:transaction\s+(?:alert|notification|update)|alert\s+from.*card|debit\s+alert|credit\s+alert)\b/i,

    // === INSTRUMENT DETECTION ===
    CREDIT_CARD: /\b(?:credit\s+card|cc\b|visa|mastercard|amex|american\s+express)\b/i,
    DEBIT_CARD: /\b(?:debit\s+card|dc\b|atm\s+card|rupay)\b/i,
    UPI: /\b(?:upi|@(?:ybl|oksbi|paytm|okhdfcbank|okicici|apl|ibl|sbi|axisbank|icici|hdfc|kotak))\b/i,
    UPI_ON_CC: /\b(?:rupay.*credit.*upi|credit\s+card.*@.*upi|upi.*credit\s+card)\b/i,
    NEFT: /\b(?:neft\s+(?:transfer|ref|txn)?|neft-?\d+)\b/i,
    IMPS: /\b(?:imps\s+(?:transfer|ref|txn)?|imps-?\d+|inter-?bank\s+mobile)\b/i,
    RTGS: /\b(?:rtgs\s+(?:transfer|ref)?)\b/i,
    SWIFT_WIRE: /\b(?:swift\s+(?:transfer|wire)|wire\s+transfer|iban)\b/i,
    WALLET: /\b(?:wallet|paytm|phonepe|gpay|google\s+pay|amazon\s+pay)\b/i,
    BANK_ACCOUNT: /\b(?:bank\s+account|savings?\s+a\/c|current\s+a\/c|a\/c\s+(?:no|ending))\b/i,
    POS: /\b(?:pos\s+terminal|swipe|chip\s+transaction|tap\s*[&and]*\s*pay|contactless)\b/i,

    // === REFERENCE NUMBERS ===
    REF_IDS: /\b(?:txn\s*(?:id|no|ref)?|ref(?:erence)?\s*(?:no|id|num)?|rrn|utr|arn|auth\s*code|transaction\s+id)\s*[:#]?\s*([A-Z0-9]+)/i,
    RRN_PATTERN: /\b(?:rrn|retrieval\s+ref)\s*[:#]?\s*(\d{12})/i,
    UTR_PATTERN: /\b(?:utr|unique\s+transaction\s+ref)\s*[:#]?\s*([A-Z0-9]+)/i,

    // === BALANCE / CONTEXT ===
    BALANCE_CONTEXT: /\b(?:avail(?:able)?\s+bal(?:ance)?|outstanding|running\s+bal(?:ance)?|bal(?:ance)?\s+after)\b/i,
    STATEMENT_CONTEXT: /\b(?:statement\s+for|monthly\s+statement|account\s+statement)\b/i,

    // === NEGATIVE SIGNALS: Non-Transaction Indicators ===
    OTP_SECURITY: /\b(?:otp|one[- ]?time\s+password|verification\s+code|login\s+(?:alert|code)|security\s+code|2fa|two[- ]?factor)\b/i,
    MARKETING: /\b(?:marketing|promotional|discount\s+(?:offer|code)|coupon|limited\s+(?:offer|time)|enjoy\s+benefits|exclusive\s+(?:offer|privilege)|flash\s+sale|cashback\s+offer|reward\s+points)\b/i,
    NEWSLETTER: /\b(?:newsletter|digest|weekly\s+update|market\s+highlights|unsubscribe|manage\s+preferences)\b/i,
    LOAN_OFFER: /\b(?:pre[- ]?approved\s+loan|loan\s+offer|personal\s+loan|credit\s+limit\s+(?:increase|offer)|check\s+eligibility)\b/i,
    UPGRADE_PROMO: /\b(?:upgrade\s+(?:program|now|offer)|apply\s+now|book\s+now|register\s+now)\b/i,

    // === FAILED/PENDING/INTENT (Non-Completed) ===
    FAILED_PENDING: /\b(?:failed|declined|rejected|unsuccessful|pending|in\s+progress|processing|initiated|attempted|trying)\b/i,
    INTENT_ONLY: /\b(?:payment\s+(?:attempt|request|link)|pay\s+now|complete\s+(?:your\s+)?payment|invoice|order\s+(?:confirmation|placed|received)|cart|checkout)\b/i,

    // === CONTEXTUAL EXCLUSIONS ===
    RECEIVING_EMAIL: /\b(?:receiving\s+this\s+email|received\s+this\s+email|why\s+you\s+received)\b/i,
    AUTO_PAY_REMINDER: /\b(?:upcoming\s+(?:bill|payment)|due\s+(?:date|on)|reminder|autopay\s+scheduled)\b/i,
};

// ============================================
// BroadFinancialDetector Class (New Architecture)
// ============================================

export class BroadFinancialDetector {

    /**
     * LEGACY API: Determine if email represents any financial activity
     * @deprecated Use detectStrict() for new architecture
     */
    static isFinancialEmail(text: string, sender?: string): boolean {
        return this.detect(text, sender).isFinancial;
    }

    /**
     * LEGACY API: Comprehensive Detection with Scoring
     * @deprecated Use detectStrict() for new architecture
     */
    static detect(text: string, sender?: string): DetectionResult {
        const strictResult = this.detectStrict(text, sender);

        // Convert to legacy format for backward compatibility
        return {
            isFinancial: strictResult.isValidTransaction,
            score: Math.round(strictResult.confidenceScore * 100),
            reasons: strictResult.isValidTransaction
                ? Object.entries(strictResult.detectedSignals)
                    .filter(([_, v]) => v === true)
                    .map(([k, _]) => k)
                : strictResult.failureReasons
        };
    }

    /**
     * NEW ARCHITECTURE: Strict Transaction Detection
     * 
     * A valid transaction must satisfy ALL of:
     * 1. Describes a completed debit or credit
     * 2. Contains a specific monetary amount
     * 3. Names or implies a financial instrument
     * 4. Originates from an authoritative source
     * 5. Indicates success, not just intent
     */
    static detectStrict(text: string, sender?: string): StrictDetectionResult {
        const lowerText = text.toLowerCase();
        const failureReasons: string[] = [];
        const reviewTriggers: ManualReviewTrigger[] = [];

        // ============================================
        // STEP 1: Authority Check (Gatekeeping)
        // ============================================
        const authorityCheck = this.checkAuthoritySource(sender);

        // Reject merchants outright (duplicate prevention)
        if (authorityCheck.isMerchant) {
            return this.createRejectionResult([`Merchant sender rejected: ${authorityCheck.merchantName}`]);
        }

        // ============================================
        // STEP 2: Negative Signal Check (Early Exit)
        // ============================================
        const negativeSignals = this.checkNegativeSignals(lowerText);
        if (negativeSignals.shouldReject) {
            return this.createRejectionResult(negativeSignals.reasons);
        }

        // ============================================
        // STEP 3: Positive Signal Detection
        // ============================================
        const amountCandidates = CurrencyNormalizer.extractCandidates(text);
        const hasAmount = amountCandidates.length > 0;
        const hasCompletionIndicator = this.hasCompletionIndicator(lowerText);
        const instrumentType = this.detectInstrument(lowerText);
        const hasInstrument = instrumentType !== null;
        const hasReferenceId = this.hasReferenceId(lowerText);
        const hasTimestamp = this.hasTimestampIndicator(lowerText);
        const hasBalanceContext = PATTERNS.BALANCE_CONTEXT.test(lowerText) || PATTERNS.STATEMENT_CONTEXT.test(lowerText);

        // ============================================
        // STEP 4: Validation Against Strict Criteria
        // ============================================

        // Criterion 1: Must have completion indicator (not just intent)
        if (!hasCompletionIndicator) {
            failureReasons.push('No completion indicator (debited/credited/successful)');
        }

        // Criterion 2: Must have monetary amount
        if (!hasAmount) {
            failureReasons.push('No monetary amount detected');
        }

        // Criterion 3: Must have or imply financial instrument
        if (!hasInstrument && !authorityCheck.isAuthoritative) {
            failureReasons.push('No financial instrument detected');
        }

        // Criterion 4: Authoritative source OR strong content signals
        const hasStrongContentSignals = hasAmount && hasCompletionIndicator && hasReferenceId;
        if (!authorityCheck.isAuthoritative && !hasStrongContentSignals) {
            failureReasons.push('Non-authoritative source without strong transaction signals');
        }

        // ============================================
        // STEP 5: Confidence Scoring
        // ============================================
        const signals: SignalDetection = {
            authoritativeSource: authorityCheck.isAuthoritative,
            sourceType: authorityCheck.sourceType,
            instrumentDetected: hasInstrument || authorityCheck.isAuthoritative,
            amountDetected: hasAmount,
            timestampDetected: hasTimestamp,
            referenceIdDetected: hasReferenceId,
            ambiguity: negativeSignals.hasWeakNegative,
            ocrUncertainty: false, // Set by PDF parser when applicable
            contradictorySignals: this.hasContradictorySignals(lowerText),
        };

        const confidenceDetails = ConfidenceScorer.calculate(signals);

        // ============================================
        // STEP 6: Manual Review Triggers
        // ============================================
        const manualReview = ConfidenceScorer.requiresManualReview(confidenceDetails, signals);
        reviewTriggers.push(...manualReview.triggers);

        // Check for zero amount
        if (hasAmount && amountCandidates.some(a => a === 0)) {
            reviewTriggers.push({
                id: crypto.randomUUID(),
                reason: ManualReviewReason.ZERO_AMOUNT,
                details: 'Zero-value transaction detected'
            });
        }

        // ============================================
        // STEP 7: Final Decision
        // ============================================
        const isValid = failureReasons.length === 0;

        return {
            isValidTransaction: isValid,
            failureReasons,
            confidenceScore: confidenceDetails.score,
            confidenceDetails,
            requiresManualReview: reviewTriggers.length > 0,
            reviewTriggers,
            sourceType: authorityCheck.sourceType,
            detectedSignals: signals,
        };
    }

    // ============================================
    // Helper Methods
    // ============================================

    private static checkAuthoritySource(sender?: string): AuthorityCheckResult {
        if (!sender) {
            return { isAuthoritative: false, isMerchant: false };
        }

        // Check for merchant (reject)
        const merchantCheck = isMerchantSender(sender);
        if (merchantCheck.isMerchant) {
            return {
                isAuthoritative: false,
                isMerchant: true,
                merchantName: merchantCheck.merchantName,
            };
        }

        // Check for financial authority
        const authCheck = isFinancialAuthority(sender);
        if (authCheck.isKnown) {
            return {
                isAuthoritative: true,
                sourceType: this.categorizeSourceType(sender, authCheck.bankName),
                bankName: authCheck.bankName,
                isMerchant: false,
            };
        }

        // Check for UPI app patterns
        if (/phonepe|gpay|paytm|bhim|amazonpay/i.test(sender)) {
            return {
                isAuthoritative: true,
                sourceType: SourceType.UPI_APP_EMAIL,
                isMerchant: false,
            };
        }

        // Check for payment gateways
        if (/razorpay|payu|billdesk|ccavenue|instamojo|stripe/i.test(sender)) {
            return {
                isAuthoritative: true,
                sourceType: SourceType.PAYMENT_GATEWAY_RECEIPT,
                isMerchant: false,
            };
        }

        return { isAuthoritative: false, isMerchant: false };
    }

    private static categorizeSourceType(sender: string, bankName?: string): SourceType {
        const lowerSender = sender.toLowerCase();

        if (lowerSender.includes('statement') || lowerSender.includes('estatement')) {
            return SourceType.MONTHLY_STATEMENT;
        }
        if (lowerSender.includes('alert') || lowerSender.includes('notification')) {
            return SourceType.BANK_ALERT;
        }
        if (/phonepe|gpay|paytm|bhim|amazonpay/i.test(lowerSender)) {
            return SourceType.UPI_APP_EMAIL;
        }

        // Default to bank alert for known banks
        return SourceType.BANK_ALERT;
    }

    private static checkNegativeSignals(lowerText: string): { shouldReject: boolean; reasons: string[]; hasWeakNegative: boolean } {
        const reasons: string[] = [];
        let shouldReject = false;
        let hasWeakNegative = false;

        // OTP / Security alerts - HARD REJECT
        if (PATTERNS.OTP_SECURITY.test(lowerText)) {
            reasons.push('OTP/Security alert detected');
            shouldReject = true;
        }

        // Failed/Pending transactions - HARD REJECT (unless reversal)
        if (PATTERNS.FAILED_PENDING.test(lowerText) && !PATTERNS.COMPLETION_SUCCESS.test(lowerText)) {
            reasons.push('Failed/Pending transaction (not completed)');
            shouldReject = true;
        }

        // Intent without payment (invoices, cart, payment links)
        if (PATTERNS.INTENT_ONLY.test(lowerText) && !PATTERNS.COMPLETION_SUCCESS.test(lowerText)) {
            reasons.push('Intent only (no payment confirmation)');
            shouldReject = true;
        }

        // Marketing / Promotional - HARD REJECT (unless has confirmation)
        if (PATTERNS.MARKETING.test(lowerText)) {
            if (!PATTERNS.COMPLETION_SUCCESS.test(lowerText)) {
                reasons.push('Marketing/Promotional email');
                shouldReject = true;
            } else {
                hasWeakNegative = true;
            }
        }

        // Newsletter / Digest - HARD REJECT
        if (PATTERNS.NEWSLETTER.test(lowerText)) {
            reasons.push('Newsletter/Digest email');
            shouldReject = true;
        }

        // Loan offers without actual transaction
        if (PATTERNS.LOAN_OFFER.test(lowerText) && !PATTERNS.COMPLETION_SUCCESS.test(lowerText)) {
            reasons.push('Loan offer (not a transaction)');
            shouldReject = true;
        }

        // Upgrade promos
        if (PATTERNS.UPGRADE_PROMO.test(lowerText) && !PATTERNS.COMPLETION_SUCCESS.test(lowerText)) {
            reasons.push('Upgrade/Promotional (not a transaction)');
            shouldReject = true;
        }

        // Auto-pay reminders (not actual transactions)
        if (PATTERNS.AUTO_PAY_REMINDER.test(lowerText) && !PATTERNS.COMPLETION_SUCCESS.test(lowerText)) {
            reasons.push('Upcoming bill/reminder (not a completed transaction)');
            shouldReject = true;
        }

        return { shouldReject, reasons, hasWeakNegative };
    }

    private static hasCompletionIndicator(lowerText: string): boolean {
        // Must have completion success OR completion verbs WITH context
        if (PATTERNS.COMPLETION_SUCCESS.test(lowerText)) {
            return true;
        }
        if (PATTERNS.COMPLETION_VERBS.test(lowerText) && !PATTERNS.RECEIVING_EMAIL.test(lowerText)) {
            return true;
        }
        if (PATTERNS.ALERT_PATTERNS.test(lowerText)) {
            return true;
        }
        return false;
    }

    private static detectInstrument(lowerText: string): string | null {
        if (PATTERNS.UPI_ON_CC.test(lowerText)) return 'upi_on_credit_card';
        if (PATTERNS.CREDIT_CARD.test(lowerText)) return 'credit_card';
        if (PATTERNS.DEBIT_CARD.test(lowerText)) return 'debit_card';
        if (PATTERNS.UPI.test(lowerText)) return 'upi';
        if (PATTERNS.NEFT.test(lowerText)) return 'neft';
        if (PATTERNS.IMPS.test(lowerText)) return 'imps';
        if (PATTERNS.RTGS.test(lowerText)) return 'rtgs';
        if (PATTERNS.SWIFT_WIRE.test(lowerText)) return 'swift_wire';
        if (PATTERNS.WALLET.test(lowerText)) return 'wallet_transfer';
        if (PATTERNS.POS.test(lowerText)) return 'pos';
        if (PATTERNS.BANK_ACCOUNT.test(lowerText)) return 'bank_account';
        return null;
    }

    private static hasReferenceId(lowerText: string): boolean {
        return PATTERNS.REF_IDS.test(lowerText) ||
            PATTERNS.RRN_PATTERN.test(lowerText) ||
            PATTERNS.UTR_PATTERN.test(lowerText);
    }

    private static hasTimestampIndicator(lowerText: string): boolean {
        // Check for date/time patterns
        return /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(lowerText) ||
            /\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/i.test(lowerText) ||
            /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}/i.test(lowerText);
    }

    private static hasContradictorySignals(lowerText: string): boolean {
        // Check for both debit and credit indicators in same message
        const hasDebit = /\b(?:debited|debit|spent|paid|charged)\b/i.test(lowerText);
        const hasCredit = /\b(?:credited|credit|received|deposited)\b/i.test(lowerText);

        // Both present is contradictory UNLESS it's a transfer context
        if (hasDebit && hasCredit && !/\b(?:transfer(?:red)?|reversal|refund)\b/i.test(lowerText)) {
            return true;
        }

        return false;
    }

    private static createRejectionResult(reasons: string[]): StrictDetectionResult {
        return {
            isValidTransaction: false,
            failureReasons: reasons,
            confidenceScore: 0,
            confidenceDetails: ConfidenceScorer.createLowConfidence(),
            requiresManualReview: false,
            reviewTriggers: [],
            detectedSignals: {
                authoritativeSource: false,
                instrumentDetected: false,
                amountDetected: false,
                timestampDetected: false,
                referenceIdDetected: false,
                ambiguity: true,
                ocrUncertainty: false,
                contradictorySignals: false,
            },
        };
    }
}
