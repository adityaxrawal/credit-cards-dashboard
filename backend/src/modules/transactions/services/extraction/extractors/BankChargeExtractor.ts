import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType, TransactionChannel } from '@shared/types/transaction.types';
import { UniversalAmountExtractor } from '../UniversalAmountExtractor';
import { TransactionDeduplicator } from '../../TransactionDeduplicator';
import { EnhancedClassificationResult } from '../../classification/EnhancedRuleClassifier';

/**
 * BankChargeExtractor - Extracts bank fee/charge transactions
 * Handles: Annual fees, maintenance charges, late payment, penalties, SMS charges, etc.
 */
export class BankChargeExtractor {
    private static readonly CHARGE_PATTERNS: Array<{ pattern: RegExp; type: string; merchant: string }> = [
        // Annual/Membership fees
        { pattern: /annual\s+(?:fee|charge)/i, type: 'annual_fee', merchant: 'Annual Fee' },
        { pattern: /membership\s+(?:fee|charge)/i, type: 'membership_fee', merchant: 'Membership Fee' },
        { pattern: /joining\s+fee/i, type: 'joining_fee', merchant: 'Joining Fee' },
        { pattern: /renewal\s+(?:fee|charge)/i, type: 'renewal_fee', merchant: 'Renewal Fee' },

        // Account maintenance
        { pattern: /(?:account|a\/c)\s+maintenance\s+(?:fee|charge)/i, type: 'maintenance', merchant: 'Account Maintenance Charge' },
        { pattern: /account\s+service\s+charge/i, type: 'service_charge', merchant: 'Account Service Charge' },
        { pattern: /(?:min|minimum)\s+balance\s+(?:charge|fee|penalty)/i, type: 'min_balance', merchant: 'Minimum Balance Charge' },
        { pattern: /non[- ]?maintenance.*average.*balance/i, type: 'min_balance', merchant: 'AMB Non-Maintenance Charge' },

        // Late/Penalty charges
        { pattern: /late\s+payment\s+(?:fee|charge|penalty)/i, type: 'late_payment', merchant: 'Late Payment Charge' },
        { pattern: /penal\s+(?:interest|charge)/i, type: 'penalty', merchant: 'Penal Charge' },
        { pattern: /(?:overdue|overdrawn)\s+(?:fee|charge|penalty)/i, type: 'penalty', merchant: 'Overdue Charge' },

        // Transaction fees
        { pattern: /(?:atm|cash)\s+(?:withdrawal|transaction)\s+(?:fee|charge)/i, type: 'atm_fee', merchant: 'ATM Transaction Fee' },
        { pattern: /(?:neft|rtgs|imps)\s+(?:transaction)?\s*(?:fee|charge)/i, type: 'transfer_fee', merchant: 'Transfer Fee' },
        { pattern: /(?:cross[- ]?currency|forex)\s+(?:fee|charge)/i, type: 'forex_fee', merchant: 'Forex Markup Fee' },

        // Service charges
        { pattern: /sms\s+(?:alert)?\s*(?:fee|charge)/i, type: 'sms_charge', merchant: 'SMS Alert Charges' },
        { pattern: /cheque\s+(?:book|issuance)\s+(?:fee|charge)/i, type: 'cheque_fee', merchant: 'Cheque Book Charges' },
        { pattern: /demat\s+(?:account)?\s*(?:maintenance|charge)/i, type: 'demat_charge', merchant: 'Demat Account Charges' },
        { pattern: /locker\s+(?:rent|charge)/i, type: 'locker_charge', merchant: 'Safe Deposit Locker Rent' },

        // GST/Tax
        { pattern: /(?:gst|tax)\s+(?:on|for)\s+(?:fee|charge|service)/i, type: 'tax', merchant: 'GST on Charges' },
    ];

    static async extract(userId: string, email: CleanEmail, classification?: EnhancedClassificationResult): Promise<ExtractedTransaction> {
        const fullText = (email.subject + ' ' + email.cleanedBody).toLowerCase();
        const originalText = email.subject + ' ' + email.cleanedBody;

        const amount = UniversalAmountExtractor.extract(originalText);

        // Identify charge type and merchant
        let chargeType = 'general';
        let merchant = 'Bank Charge';

        for (const { pattern, type, merchant: merchantName } of this.CHARGE_PATTERNS) {
            if (pattern.test(fullText)) {
                chargeType = type;
                merchant = merchantName;
                break;
            }
        }

        // Try to extract reference numbers
        const rrnMatch = originalText.match(/(?:rrn|ref(?:erence)?)[:\s#]*(\d{10,})/i);
        const utrMatch = originalText.match(/(?:utr)[:\s#]*([A-Z0-9]{12,})/i);

        // Extract any GST component
        const gstMatch = originalText.match(/(?:gst|cgst|sgst|igst)[:\s]*[₹Rs.INR]*\s*([\d,]+(?:\.\d{2})?)/i);
        const gstAmount = gstMatch ? parseFloat(gstMatch[1].replace(/,/g, '')) : undefined;

        const fingerprint = TransactionDeduplicator.generateFingerprint({
            amount,
            merchant,
            date: new Date(email.internalDate),
            direction: TransactionDirection.DEBIT
        });

        return {
            type: TransactionType.BANK_CHARGE,
            direction: TransactionDirection.DEBIT,
            amount,
            currency: 'INR',
            merchant,
            instrumentType: InstrumentType.BANK_ACCOUNT,
            instrumentId: undefined,
            category: 'Fees & Charges',
            fingerprint,
            rrn: rrnMatch?.[1],
            utr: utrMatch?.[1],
            channel: TransactionChannel.INTERNAL,
            feeComponents: gstAmount ? { gst: gstAmount } : undefined,
            patternGroupId: classification?.metadata?.pattern,
            ruleId: classification?.metadata?.pattern,
            metadata: {
                extractedAt: new Date().toISOString(),
                chargeType,
                feeType: merchant
            }
        };
    }
}
