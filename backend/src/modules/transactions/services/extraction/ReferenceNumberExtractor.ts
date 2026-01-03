/**
 * ReferenceNumberExtractor - New Architecture Transaction Detection
 * 
 * Extracts various reference numbers from transaction text:
 * - RRN (Retrieval Reference Number)
 * - ARN (Acquirer Reference Number)
 * - UTR (Unique Transaction Reference)
 * - Transaction ID / Txn ID
 * - Authorization Code
 * - UPI Reference Number
 */

export interface ExtractedReferences {
    rrn?: string;
    arn?: string;
    utr?: string;
    transactionId?: string;
    authCode?: string;
    upiRef?: string;
    impsRef?: string;
    neftRef?: string;
    orderRef?: string;
}

export class ReferenceNumberExtractor {
    // ============================================
    // Reference Number Patterns
    // ============================================

    // RRN - 12 digit numeric
    private static readonly RRN_PATTERNS: RegExp[] = [
        /(?:rrn|retrieval\s+ref(?:erence)?(?:\s+no)?)[:\s]*(\d{12})/i,
        /(?:ref\s+no|reference\s+no)[:\s]*(\d{12})/i,
    ];

    // ARN - 23 character alphanumeric
    private static readonly ARN_PATTERNS: RegExp[] = [
        /(?:arn|acquirer\s+ref)[:\s]*([A-Z0-9]{23})/i,
        /(?:auth\s+ref|authorization\s+ref)[:\s]*([A-Z0-9]{20,24})/i,
    ];

    // UTR - Variable length alphanumeric
    private static readonly UTR_PATTERNS: RegExp[] = [
        /(?:utr|unique\s+transaction\s+ref)[:\s]*([A-Z0-9]{16,24})/i,
        /(?:utr\s+no|utr\s+number)[:\s]*([A-Z0-9]{16,24})/i,
    ];

    // Transaction ID patterns
    private static readonly TXN_ID_PATTERNS: RegExp[] = [
        /(?:txn\s+id|transaction\s+id|txn\s+no)[:\s]*([A-Z0-9]{6,20})/i,
        /(?:payment\s+id|order\s+id)[:\s]*([A-Z0-9]{6,20})/i,
        /(?:ref(?:erence)?\s*(?:#|no|id)?)[:\s]*([A-Z0-9]{8,20})/i,
    ];

    // Authorization Code - Usually 6 digits
    private static readonly AUTH_CODE_PATTERNS: RegExp[] = [
        /(?:auth(?:orization)?\s+code|auth\s+no|approval\s+code)[:\s]*([A-Z0-9]{6})/i,
    ];

    // UPI Reference - 12 digit numeric
    private static readonly UPI_REF_PATTERNS: RegExp[] = [
        /(?:upi\s+ref|upi\s+transaction\s+id)[:\s]*(\d{12})/i,
        /(?:upi\s+id|upi\s+txn)[:\s]*(\d{12})/i,
    ];

    // IMPS Reference
    private static readonly IMPS_REF_PATTERNS: RegExp[] = [
        /(?:imps\s+ref|imps\s+txn)[:\s]*([A-Z0-9]{12,16})/i,
    ];

    // NEFT Reference
    private static readonly NEFT_REF_PATTERNS: RegExp[] = [
        /(?:neft\s+ref|neft\s+txn)[:\s]*([A-Z0-9]{16,24})/i,
    ];

    /**
     * Extract all reference numbers from text
     */
    static extractAll(text: string): ExtractedReferences {
        const refs: ExtractedReferences = {};

        // Extract RRN
        for (const pattern of this.RRN_PATTERNS) {
            const match = text.match(pattern);
            if (match && match[1]) {
                refs.rrn = match[1];
                break;
            }
        }

        // Extract ARN
        for (const pattern of this.ARN_PATTERNS) {
            const match = text.match(pattern);
            if (match && match[1]) {
                refs.arn = match[1].toUpperCase();
                break;
            }
        }

        // Extract UTR
        for (const pattern of this.UTR_PATTERNS) {
            const match = text.match(pattern);
            if (match && match[1]) {
                refs.utr = match[1].toUpperCase();
                break;
            }
        }

        // Extract Transaction ID
        for (const pattern of this.TXN_ID_PATTERNS) {
            const match = text.match(pattern);
            if (match && match[1]) {
                refs.transactionId = match[1];
                break;
            }
        }

        // Extract Auth Code
        for (const pattern of this.AUTH_CODE_PATTERNS) {
            const match = text.match(pattern);
            if (match && match[1]) {
                refs.authCode = match[1].toUpperCase();
                break;
            }
        }

        // Extract UPI Reference
        for (const pattern of this.UPI_REF_PATTERNS) {
            const match = text.match(pattern);
            if (match && match[1]) {
                refs.upiRef = match[1];
                break;
            }
        }

        // Extract IMPS Reference
        for (const pattern of this.IMPS_REF_PATTERNS) {
            const match = text.match(pattern);
            if (match && match[1]) {
                refs.impsRef = match[1].toUpperCase();
                break;
            }
        }

        // Extract NEFT Reference
        for (const pattern of this.NEFT_REF_PATTERNS) {
            const match = text.match(pattern);
            if (match && match[1]) {
                refs.neftRef = match[1].toUpperCase();
                break;
            }
        }

        return refs;
    }

    /**
     * Get primary reference number (best one available)
     */
    static getPrimaryReference(refs: ExtractedReferences): string | undefined {
        // Priority: RRN > ARN > UTR > UPI Ref > Transaction ID
        return refs.rrn || refs.arn || refs.utr || refs.upiRef || refs.transactionId;
    }

    /**
     * Check if any reference number was extracted
     */
    static hasReference(refs: ExtractedReferences): boolean {
        return Object.values(refs).some(v => v !== undefined);
    }
}
