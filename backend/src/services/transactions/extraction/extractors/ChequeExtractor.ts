import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType, TransactionChannel } from '../../../../types/transaction.types';
import { UniversalAmountExtractor } from '../UniversalAmountExtractor';
import { TransactionDeduplicator } from '../../TransactionDeduplicator';
import { EnhancedClassificationResult } from '../../classification/EnhancedRuleClassifier';

/**
 * ChequeExtractor - Extracts cheque deposit and return transactions
 * Handles: Cheque deposits, cheque clearance, cheque bounced/returned, outward cheques
 */
export class ChequeExtractor {
    private static readonly CHEQUE_DEPOSIT_PATTERNS: RegExp[] = [
        /cheque\s+(?:deposited|credit|cleared)/i,
        /(?:chq|cheque)\s+no\.?\s*\d+\s+(?:credited|deposited|cleared)/i,
        /local\s+cheque\s+(?:collection|credit)/i,
        /outstation\s+cheque\s+(?:collection|credit)/i,
        /cheque\s+realization/i,
    ];

    private static readonly CHEQUE_RETURN_PATTERNS: RegExp[] = [
        /cheque\s+(?:returned|bounced|dishonoured|dishonored)/i,
        /(?:chq|cheque)\s+(?:return|bounce)/i,
        /insufficient\s+funds?.*cheque/i,
        /cheque\s+(?:inward\s+)?return/i,
        /reason\s+for\s+return/i,
    ];

    private static readonly OUTWARD_CHEQUE_PATTERNS: RegExp[] = [
        /(?:outward|issued)\s+cheque\s+(?:debited|debit|cleared)/i,
        /cheque\s+issued\s+by\s+you/i,
        /your\s+cheque.*debited/i,
    ];

    static async extract(userId: string, email: CleanEmail, classification?: EnhancedClassificationResult): Promise<ExtractedTransaction> {
        const fullText = (email.subject + ' ' + email.cleanedBody).toLowerCase();
        const originalText = email.subject + ' ' + email.cleanedBody;

        const amount = UniversalAmountExtractor.extract(originalText);

        // Determine cheque transaction type
        let isDeposit = false;
        let isReturn = false;
        let isOutward = false;

        for (const pattern of this.CHEQUE_DEPOSIT_PATTERNS) {
            if (pattern.test(fullText)) {
                isDeposit = true;
                break;
            }
        }

        for (const pattern of this.CHEQUE_RETURN_PATTERNS) {
            if (pattern.test(fullText)) {
                isReturn = true;
                break;
            }
        }

        for (const pattern of this.OUTWARD_CHEQUE_PATTERNS) {
            if (pattern.test(fullText)) {
                isOutward = true;
                break;
            }
        }

        // Determine transaction type and direction
        let type: TransactionType;
        let direction: TransactionDirection;
        let merchant: string;

        if (isReturn) {
            type = TransactionType.CHEQUE_RETURN;
            direction = TransactionDirection.DEBIT; // Usually debit for return charges
            merchant = 'Cheque Return';
        } else if (isOutward) {
            type = TransactionType.BANK_DEBIT; // Outward cheque is a debit
            direction = TransactionDirection.DEBIT;
            merchant = 'Cheque Payment';
        } else {
            type = TransactionType.CHEQUE_DEPOSIT;
            direction = TransactionDirection.CREDIT;
            merchant = 'Cheque Deposit';
        }

        // Extract cheque number
        const chequeNumberMatch = originalText.match(/(?:cheque|chq|check)\s*(?:no\.?|number|#)?\s*[:\s]*(\d{6,})/i);
        const chequeNumber = chequeNumberMatch?.[1];

        // Extract bank/payee/payer
        const fromBankMatch = originalText.match(/(?:drawn\s+on|from|payee\s+bank)[:\s]+([A-Za-z\s]+Bank)/i);
        const fromBank = fromBankMatch?.[1]?.trim();

        // Extract return reason if applicable
        let returnReason: string | undefined;
        if (isReturn) {
            const reasonMatch = originalText.match(/(?:reason|cause)[:\s]+(.{10,60}?)(?:\.|$|\n)/i);
            returnReason = reasonMatch?.[1]?.trim();
        }

        const fingerprint = TransactionDeduplicator.generateFingerprint({
            amount,
            merchant: chequeNumber ? `Cheque ${chequeNumber}` : merchant,
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
            category: isReturn ? 'Fees & Charges' : (direction === TransactionDirection.CREDIT ? 'Income' : 'Transfers'),
            fingerprint,
            channel: TransactionChannel.CHEQUE,
            patternGroupId: classification?.metadata?.pattern,
            ruleId: classification?.metadata?.pattern,
            counterpartyName: fromBank,
            metadata: {
                extractedAt: new Date().toISOString(),
                chequeNumber,
                chequeType: isOutward ? 'outward' : 'inward',
                returnReason,
                fromBank
            }
        };
    }
}
