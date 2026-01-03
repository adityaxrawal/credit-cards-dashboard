import { ClassificationResult, CleanEmail, TransactionType } from '@shared/types/transaction.types';

import { NumberParser } from '@modules/parser/NumberParser';

export abstract class BaseClassifier {
    abstract readonly priority: number; // Lower number = higher priority
    abstract readonly name: string;

    abstract classify(userId: string, cleanEmail: CleanEmail): Promise<ClassificationResult | null>;

    protected extractAmount(text: string): number | null {
        return NumberParser.parseAmount(text);
    }

    protected extractDate(text: string, fallbackDate: number): Date {
        const datePatterns = [
            /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/, // DD/MM/YYYY or DD-MM-YYYY
            /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,      // Month DD, YYYY
        ];

        for (const pattern of datePatterns) {
            const match = text.match(pattern);
            if (match) {
                // Simple parsing attempt - can be improved with dayjs or date-fns
                // For now, return fallback to stay safe on parsing errors unless robust
            }
        }

        // Fallback to email timestamp
        return new Date(fallbackDate);
    }

    protected cleanMerchantName(merchant: string): string {
        return merchant.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    }
}
