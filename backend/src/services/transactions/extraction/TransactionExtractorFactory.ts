import { TransactionType, CleanEmail, ExtractedTransaction } from '../../../types/transaction.types';
import { CreditCardPaymentExtractor } from './extractors/CreditCardPaymentExtractor';

/**
 * Interface that all transaction extractors must implement
 */
export interface ITransactionExtractor {
    extract(userId: string, email: CleanEmail): Promise<ExtractedTransaction>;
}

/**
 * Type for extractor classes (static implementation)
 */
export type TransactionExtractorClass = {
    extract(userId: string, email: CleanEmail): Promise<ExtractedTransaction>;
};

export class TransactionExtractorFactory {
    private static extractors = new Map<TransactionType, TransactionExtractorClass>();

    static register(type: TransactionType, Extractor: TransactionExtractorClass): void {
        this.extractors.set(type, Extractor);
    }

    // Register Default Extractors (Should probably be done at startup, but for now we can do static block or manual call)
    static {
        this.register(TransactionType.CREDIT_CARD_PAYMENT, CreditCardPaymentExtractor);
    }

    static getExtractor(type: TransactionType): TransactionExtractorClass {
        const Extractor = this.extractors.get(type);
        if (!Extractor) {
            // Return a default or throw? Throwing is safer as missing extractor means incomplete implementation
            throw new Error(`No extractor registered for type: ${type}`);
        }
        return Extractor;
    }
}
