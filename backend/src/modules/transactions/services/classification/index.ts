import { ClassifierRegistry } from './ClassifierRegistry';
import { TransactionExtractorFactory } from '../extraction/TransactionExtractorFactory';
import { TransactionType } from '@shared/types/transaction.types';

// Detectors
import { StatementDetector } from './detectors/StatementDetector';
import { CreditCardSpendDetector } from './detectors/CreditCardSpendDetector';
import { CreditCardUPIDetector } from './detectors/CreditCardUPIDetector';
import { BankAccountCreditDetector } from './detectors/BankAccountCreditDetector';
import { BankAccountUPIDebitDetector } from './detectors/BankAccountUPIDebitDetector';
import { BankAccountUPICreditDetector } from './detectors/BankAccountUPICreditDetector';
import { RefundReversalDetector } from './detectors/RefundReversalDetector';
import { UpiClassifier } from './detectors/UpiClassifier';
import { InternationalClassifier } from './detectors/InternationalClassifier';


// Extractors
import { CreditCardSpendExtractor } from '../extraction/extractors/CreditCardSpendExtractor';
import { CreditCardUPIExtractor } from '../extraction/extractors/CreditCardUPIExtractor';
import { BankAccountCreditExtractor } from '../extraction/extractors/BankAccountCreditExtractor';
import { BankAccountDebitExtractor } from '../extraction/extractors/BankAccountDebitExtractor';
import { BankAccountUPIDebitExtractor } from '../extraction/extractors/BankAccountUPIDebitExtractor';
import { BankAccountUPICreditExtractor } from '../extraction/extractors/BankAccountUPICreditExtractor';
import { RefundExtractor } from '../extraction/extractors/RefundExtractor';

export function registerAll() {
    // Register Classifiers
    ClassifierRegistry.register(new StatementDetector());
    ClassifierRegistry.register(new CreditCardSpendDetector());
    ClassifierRegistry.register(new CreditCardUPIDetector());
    ClassifierRegistry.register(new BankAccountCreditDetector());
    ClassifierRegistry.register(new BankAccountUPIDebitDetector());
    ClassifierRegistry.register(new BankAccountUPICreditDetector());
    ClassifierRegistry.register(new BankAccountUPICreditDetector());
    ClassifierRegistry.register(new RefundReversalDetector());
    // New Classifiers
    ClassifierRegistry.register(new UpiClassifier());
    ClassifierRegistry.register(new InternationalClassifier());


    // Register Extractors
    TransactionExtractorFactory.register(TransactionType.CREDIT_CARD_SPEND, CreditCardSpendExtractor);
    TransactionExtractorFactory.register(TransactionType.CREDIT_CARD_UPI, CreditCardUPIExtractor);
    TransactionExtractorFactory.register(TransactionType.BANK_CREDIT, BankAccountCreditExtractor);
    TransactionExtractorFactory.register(TransactionType.SALARY, BankAccountCreditExtractor); // Re-use for SALARY
    TransactionExtractorFactory.register(TransactionType.BANK_DEBIT, BankAccountDebitExtractor);
    TransactionExtractorFactory.register(TransactionType.BANK_ACCOUNT_UPI_DEBIT, BankAccountUPIDebitExtractor);
    TransactionExtractorFactory.register(TransactionType.BANK_ACCOUNT_UPI_CREDIT, BankAccountUPICreditExtractor);
    TransactionExtractorFactory.register(TransactionType.REFUND_REVERSAL, RefundExtractor);
    TransactionExtractorFactory.register(TransactionType.CHARGEBACK, RefundExtractor);
    TransactionExtractorFactory.register(TransactionType.STATEMENT_TRANSACTION, CreditCardSpendExtractor); // Fallback for statement txns
    TransactionExtractorFactory.register('cc_debit' as any, CreditCardSpendExtractor); // Handle common GPT hallucination
}
