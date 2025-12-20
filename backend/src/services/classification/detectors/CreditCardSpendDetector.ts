import { BaseClassifier } from '../BaseClassifier';
import { InstrumentService } from '../../instruments/InstrumentService';
import { ClassificationResult, CleanEmail, TransactionType, InstrumentType } from '../../../types/transaction.types';

export class CreditCardSpendDetector extends BaseClassifier {
    readonly priority = 2;
    readonly name = 'CreditCardSpendDetector';

    async classify(userId: string, email: CleanEmail): Promise<ClassificationResult | null> {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();

        // ====== PRECONDITION: Spend Keywords ======
        const hasSpendKeywords = /spent|purchase|charged|debited|transaction|paid/i.test(text);
        if (!hasSpendKeywords) return null;

        // Reject if it looks like UPI or Bank transfer (handled by other detectors)
        if (/upi/i.test(text) || /neft|rtgs|imps/i.test(text)) return null;

        // ====== EXTRACT CARD IDENTIFIER ======
        // Pattern: "CC XX1234" or "XX1234" or "ending 1234"
        const cardMatches = [
            /(?:credit card|cc)[\s\w]*?xx(\d{4})/i,
            /card[\s\w]*?ending[\s\w]*?(\d{4})/i,
            /xx(\d{4})/i,
        ];

        let last4: string | null = null;
        for (const pattern of cardMatches) {
            const match = text.match(pattern);
            if (match) {
                last4 = match[1];
                break;
            }
        }

        if (!last4) return null; // No card identifier found

        // ====== VERIFY CARD REGISTERED ======
        const instrument = await InstrumentService.getCardByIdentifier(userId, '', last4); // Bank name is hard to extract reliably here without extraction logic 
        // Ideally we pass a wildcard bank or loop through known user banks, but Service supports partial match on bank if provided.
        // For now, let's try to see if ANY card matches last4.
        // Enhanced getCardByIdentifier needed? The current one filters by bank.
        // Let's use getUserInstruments and filter manually to be safe.

        const instruments = await InstrumentService.getUserInstruments(userId);
        const userCard = instruments.find(
            i => (i.instrument_type === InstrumentType.CREDIT_CARD) &&
                i.account_number_masked.endsWith(last4)
        );

        // ====== EXTRACT AMOUNT ======
        const amount = this.extractAmount(text);
        if (!amount || amount <= 0) return null;

        // ====== EXTRACT MERCHANT ======
        const originalText = email.subject + ' ' + email.cleanedBody;
        const merchantMatch = originalText.match(/(?:at|from|with|to)\s+([a-z0-9\s.&'-]{3,50}?)(?:\s+for|\s+on|\.|₹|\$|using|via|$)/i);
        const merchant = merchantMatch ? this.cleanMerchantName(merchantMatch[1]) : 'Unknown';

        if (userCard) {
            return {
                type: TransactionType.CREDIT_CARD_SPEND,
                confidence: 0.95, // High confidence: keywords + registered card
                metadata: {
                    cardLast4: last4,
                    cardRegistered: true,
                    instrumentId: userCard.id,
                    merchant,
                    amount,
                }
            };
        } else {
            // Card not registered, return lower confidence
            return {
                type: TransactionType.CREDIT_CARD_SPEND,
                confidence: 0.65, // Lower confidence, may use as fallback or prompt user
                metadata: {
                    cardLast4: last4,
                    cardRegistered: false,
                    merchant,
                    amount
                }
            };
        }
    }
}
