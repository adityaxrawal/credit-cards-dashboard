
import { BaseClassifier } from '../BaseClassifier';
import { ClassificationResult, CleanEmail, TransactionType } from '../../../../types/transaction.types';

export class InternationalClassifier extends BaseClassifier {
    readonly priority = 3;
    readonly name = 'International Classifier';

    async classify(userId: string, cleanEmail: CleanEmail): Promise<ClassificationResult | null> {
        const text = (cleanEmail.subject + ' ' + cleanEmail.cleanedBody).toLowerCase();

        // International Detection: 
        // 1. Non-INR currency symbols ($, €, £, USD, EUR) - Handled by extractAmount but we check explicitly here.
        // 2. "International Usage" or "Cross Border" keywords.

        const foreignCurrencyMatch = text.match(/(?:usd|eur|gbp|sgd|aud|\$|€|£)\s*([\d,]+\.?\d*)/i);
        const keywordMatch = text.includes('international usage') || text.includes('cross border') || text.includes('foreign currency');

        if (!foreignCurrencyMatch && !keywordMatch) return null;

        let amount = 0;
        let currency = 'INR'; // Default, often banks report BOTH source and INR amount.

        // If we found a foreign amount, we might want to store that. 
        // But the system primarily tracks INR. Usually banks say "Spent USD 10 (INR 840)".
        // We prioritize finding the INR equivalent if present.

        const inrMatch = text.match(/(?:rs\.?|inr)\s*([\d,]+\.?\d*)/i);
        if (inrMatch) {
            amount = parseFloat(inrMatch[1].replace(/,/g, ''));
        } else if (foreignCurrencyMatch) {
            // Fallback to foreign amount if INR not found (rare for Indian bank alerts)
            amount = parseFloat(foreignCurrencyMatch[1].replace(/,/g, ''));
            // Try to guess currency
            if (text.includes('usd') || text.includes('$')) currency = 'USD';
            if (text.includes('eur') || text.includes('€')) currency = 'EUR';
        }

        if (amount === 0) return null;

        // Use internalDate (number) for date extraction
        const date = this.extractDate(text, cleanEmail.internalDate);

        return {
            type: TransactionType.CREDIT_CARD_SPEND,
            confidence: 0.9,
            metadata: {
                original_merchant: 'International Merchant',
                is_international: true,
                related_message_ids: [cleanEmail.id]
            }
        };
    }
}
