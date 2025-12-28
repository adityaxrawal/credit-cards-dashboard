import { TransactionType, CleanEmail, ExtractedTransaction } from '../../../types/transaction.types';
import { MissingExtractorError } from '../../../utils/AppError';

// Extractors
import { CreditCardPaymentExtractor } from './extractors/CreditCardPaymentExtractor';
import { CreditCardSpendExtractor } from './extractors/CreditCardSpendExtractor';
import { CreditCardUPIExtractor } from './extractors/CreditCardUPIExtractor';
import { InvestmentExtractor } from './extractors/InvestmentExtractor';
import { BankAccountCreditExtractor } from './extractors/BankAccountCreditExtractor';
import { BankAccountDebitExtractor } from './extractors/BankAccountDebitExtractor';
import { BankAccountUPIDebitExtractor } from './extractors/BankAccountUPIDebitExtractor';
import { BankAccountUPICreditExtractor } from './extractors/BankAccountUPICreditExtractor';
import { RefundExtractor } from './extractors/RefundExtractor';

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
    private static initialized = false;

    static register(type: TransactionType, Extractor: TransactionExtractorClass): void {
        this.extractors.set(type, Extractor);
    }

    static initializeDefaults(): void {
        if (this.initialized) return;

        this.register(TransactionType.CREDIT_CARD_SPEND, CreditCardSpendExtractor);
        this.register(TransactionType.CREDIT_CARD_PAYMENT, CreditCardPaymentExtractor);
        this.register(TransactionType.CREDIT_CARD_UPI, CreditCardUPIExtractor);
        this.register(TransactionType.BANK_CREDIT, BankAccountCreditExtractor);
        this.register(TransactionType.SALARY, BankAccountCreditExtractor);
        this.register(TransactionType.BANK_DEBIT, BankAccountDebitExtractor);
        this.register(TransactionType.BANK_ACCOUNT_UPI_DEBIT, BankAccountUPIDebitExtractor);
        this.register(TransactionType.BANK_ACCOUNT_UPI_CREDIT, BankAccountUPICreditExtractor);
        this.register(TransactionType.REFUND_REVERSAL, RefundExtractor);
        this.register(TransactionType.CHARGEBACK, RefundExtractor);
        this.register(TransactionType.STATEMENT_TRANSACTION, CreditCardSpendExtractor);
        this.register(TransactionType.INVESTMENT, InvestmentExtractor);

        // Handle common GPT hallucination
        this.register('cc_debit' as any, CreditCardSpendExtractor);
        this.register('transport' as any, CreditCardSpendExtractor);
        this.register('travel' as any, CreditCardSpendExtractor);
        this.register('food' as any, CreditCardSpendExtractor);

        this.initialized = true;
    }

    static getExtractor(type: TransactionType): TransactionExtractorClass {
        // Auto-initialize if empty or specific key missing (lazy load safety)
        if (this.extractors.size === 0 || !this.extractors.has(type)) {
            this.initializeDefaults();
        }

        const Extractor = this.extractors.get(type);
        if (!Extractor) {
            throw new MissingExtractorError(`No extractor registered for type: ${type}`);
        }
        return Extractor;
    }

    // For testing purposes
    static reset(): void {
        this.extractors.clear();
        this.initialized = false;
    }
}
