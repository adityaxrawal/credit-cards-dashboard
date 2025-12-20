import { TransactionType } from '../../types/transaction.types';

export class TransactionExtractorFactory {
    private static extractors = new Map<TransactionType, any>();

    static register(type: TransactionType, Extractor: any): void {
        this.extractors.set(type, Extractor);
    }

    static getExtractor(type: TransactionType): any {
        const Extractor = this.extractors.get(type);
        if (!Extractor) {
            // Return a default or throw? Throwing is safer as missing extractor means incomplete implementation
            throw new Error(`No extractor registered for type: ${type}`);
        }
        return Extractor;
    }
}
