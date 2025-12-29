import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType, TransactionChannel } from '../../../../types/transaction.types';
import { UniversalAmountExtractor } from '../UniversalAmountExtractor';
import { TransactionDeduplicator } from '../../TransactionDeduplicator';
import { EnhancedClassificationResult } from '../../classification/EnhancedRuleClassifier';

/**
 * InterestExtractor - Extracts interest credit/debit transactions
 * Handles: Savings account interest, FD interest, overdraft interest, loan interest, etc.
 */
export class InterestExtractor {
    private static readonly INTEREST_CREDIT_PATTERNS: RegExp[] = [
        /interest\s+(?:credited|credit|earned|received)/i,
        /credited.*interest/i,
        /(?:savings|fd|fixed\s+deposit|rd).*interest.*credited/i,
        /interest\s+(?:for|of)\s+(?:quarter|month|period)/i,
        /quarterly\s+interest/i,
    ];

    private static readonly INTEREST_DEBIT_PATTERNS: RegExp[] = [
        /interest\s+(?:debited|debit|charged|deducted)/i,
        /(?:overdraft|od).*interest/i,
        /(?:loan|emi).*interest\s+(?:debited|charged)/i,
        /penal\s+interest/i,
        /interest\s+on\s+(?:overdue|outstanding)/i,
    ];

    static async extract(userId: string, email: CleanEmail, classification?: EnhancedClassificationResult): Promise<ExtractedTransaction> {
        const fullText = (email.subject + ' ' + email.cleanedBody).toLowerCase();
        const originalText = email.subject + ' ' + email.cleanedBody;

        const amount = UniversalAmountExtractor.extract(originalText);

        // Determine if credit or debit
        let isCredit = false;
        for (const pattern of this.INTEREST_CREDIT_PATTERNS) {
            if (pattern.test(fullText)) {
                isCredit = true;
                break;
            }
        }

        // Default to debit if debit patterns match (override credit)
        for (const pattern of this.INTEREST_DEBIT_PATTERNS) {
            if (pattern.test(fullText)) {
                isCredit = false;
                break;
            }
        }

        // Determine interest type
        let interestType = 'general';
        let merchant = isCredit ? 'Interest Credited' : 'Interest Debited';

        if (/(?:savings|saving\s+account)/i.test(fullText)) {
            interestType = 'savings';
            merchant = 'Savings Account Interest';
        } else if (/(?:fd|fixed\s+deposit)/i.test(fullText)) {
            interestType = 'fd';
            merchant = 'Fixed Deposit Interest';
        } else if (/(?:rd|recurring\s+deposit)/i.test(fullText)) {
            interestType = 'rd';
            merchant = 'Recurring Deposit Interest';
        } else if (/(?:overdraft|od)/i.test(fullText)) {
            interestType = 'overdraft';
            merchant = 'Overdraft Interest';
        } else if (/(?:loan|home\s+loan|personal\s+loan|car\s+loan)/i.test(fullText)) {
            interestType = 'loan';
            merchant = 'Loan Interest';
        } else if (/penal/i.test(fullText)) {
            interestType = 'penal';
            merchant = 'Penal Interest';
        }

        // Try to extract interest rate
        const rateMatch = originalText.match(/(?:rate|@)\s*(\d+(?:\.\d+)?)\s*%/i);
        const interestRate = rateMatch ? parseFloat(rateMatch[1]) : undefined;

        // Try to extract period
        const periodMatch = originalText.match(/(?:for\s+(?:the\s+)?(?:period|quarter|month))\s+([A-Za-z]+\s*\d{4}|\d{2}\/\d{2}\/\d{4})/i);
        const period = periodMatch?.[1];

        // Extract reference numbers
        const utrMatch = originalText.match(/(?:utr)[:\s#]*([A-Z0-9]{12,})/i);

        const direction = isCredit ? TransactionDirection.CREDIT : TransactionDirection.DEBIT;

        const fingerprint = TransactionDeduplicator.generateFingerprint({
            amount,
            merchant,
            date: new Date(email.internalDate),
            direction
        });

        return {
            type: isCredit ? TransactionType.INTEREST_CREDIT : TransactionType.INTEREST_DEBIT,
            direction,
            amount,
            currency: 'INR',
            merchant,
            instrumentType: InstrumentType.BANK_ACCOUNT,
            instrumentId: undefined,
            category: isCredit ? 'Income' : 'Fees & Charges',
            fingerprint,
            utr: utrMatch?.[1],
            channel: TransactionChannel.INTERNAL,
            patternGroupId: classification?.metadata?.pattern,
            ruleId: classification?.metadata?.pattern,
            metadata: {
                extractedAt: new Date().toISOString(),
                interestType,
                interestRate,
                period
            }
        };
    }
}
