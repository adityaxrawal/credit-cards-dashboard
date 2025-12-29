import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType, TransactionChannel } from '../../../../types/transaction.types';
import { UniversalAmountExtractor } from '../UniversalAmountExtractor';
import { TransactionDeduplicator } from '../../TransactionDeduplicator';
import { EnhancedClassificationResult } from '../../classification/EnhancedRuleClassifier';

/**
 * StandingInstructionExtractor - Extracts eNACH, standing orders, and mandate transactions
 * Handles: eNACH debits, standing instructions, auto-pay, mandate registrations
 */
export class StandingInstructionExtractor {
    private static readonly ENACH_PATTERNS: RegExp[] = [
        /e[- ]?nach\s+(?:debit|mandate|transaction)/i,
        /nach\s+(?:debit|mandate|transaction)/i,
        /auto[- ]?(?:debit|pay)\s+(?:processed|successful)/i,
        /mandate.*(?:debited|executed)/i,
        /recurring\s+(?:debit|payment)\s+(?:processed|successful)/i,
    ];

    private static readonly STANDING_ORDER_PATTERNS: RegExp[] = [
        /standing\s+(?:instruction|order)\s+(?:executed|processed)/i,
        /si\s+(?:debit|transaction)/i,
        /scheduled\s+(?:payment|transfer)\s+(?:executed|processed)/i,
        /periodic\s+payment/i,
    ];

    private static readonly MANDATE_REGISTRATION_PATTERNS: RegExp[] = [
        /mandate\s+(?:registered|created|approved)/i,
        /e[- ]?nach\s+(?:registration|mandate\s+created)/i,
        /auto[- ]?pay\s+(?:activated|setup|enabled)/i,
    ];

    static async extract(userId: string, email: CleanEmail, classification?: EnhancedClassificationResult): Promise<ExtractedTransaction> {
        const fullText = (email.subject + ' ' + email.cleanedBody).toLowerCase();
        const originalText = email.subject + ' ' + email.cleanedBody;

        const amount = UniversalAmountExtractor.extract(originalText);

        // Determine transaction subtype
        let isEnach = false;
        let isStandingOrder = false;
        let isMandateRegistration = false;

        for (const pattern of this.ENACH_PATTERNS) {
            if (pattern.test(fullText)) {
                isEnach = true;
                break;
            }
        }

        for (const pattern of this.STANDING_ORDER_PATTERNS) {
            if (pattern.test(fullText)) {
                isStandingOrder = true;
                break;
            }
        }

        for (const pattern of this.MANDATE_REGISTRATION_PATTERNS) {
            if (pattern.test(fullText)) {
                isMandateRegistration = true;
                break;
            }
        }

        // Extract merchant/beneficiary
        let merchant = 'Standing Instruction';
        const merchantMatch = originalText.match(/(?:to|beneficiary|payee|for)[:\s]+([A-Za-z0-9\s]+?)(?:via|on|from|\.|$|\n)/i);
        if (merchantMatch) {
            merchant = merchantMatch[1].trim().substring(0, 50);
        }

        // Extract mandate ID
        const mandateMatch = originalText.match(/(?:mandate|umrn|reference)\s*(?:id|no\.?|#)?[:\s]*([A-Z0-9]{10,})/i);
        const mandateId = mandateMatch?.[1];

        // Extract UTR
        const utrMatch = originalText.match(/(?:utr|ref(?:erence)?)[:\s#]*([A-Z0-9]{12,})/i);

        // Determine type
        let type = TransactionType.STANDING_INSTRUCTION;
        let direction = TransactionDirection.DEBIT;

        if (isEnach) {
            type = TransactionType.ENACH;
        } else if (isMandateRegistration) {
            // Mandate registration is not a transaction, but we log it
            merchant = 'Mandate Registration';
        }

        // Extract frequency if mentioned
        const frequencyMatch = originalText.match(/(?:frequency|period)[:\s]+(\w+)/i);
        const frequency = frequencyMatch?.[1]?.toLowerCase();

        const fingerprint = TransactionDeduplicator.generateFingerprint({
            amount,
            merchant,
            date: new Date(email.internalDate),
            direction
        });

        return {
            type,
            direction,
            amount,
            currency: 'INR',
            merchant,
            instrumentType: InstrumentType.BANK_ACCOUNT,
            instrumentId: undefined,
            category: 'Bills & Utilities',
            fingerprint,
            utr: utrMatch?.[1],
            channel: TransactionChannel.NETBANKING,
            isRecurring: true,
            patternGroupId: classification?.metadata?.pattern,
            ruleId: classification?.metadata?.pattern,
            metadata: {
                extractedAt: new Date().toISOString(),
                mandateId,
                frequency,
                instructionType: isEnach ? 'enach' : (isStandingOrder ? 'standing_order' : 'mandate')
            }
        };
    }
}
