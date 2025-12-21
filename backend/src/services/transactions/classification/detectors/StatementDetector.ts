import { BaseClassifier } from '../BaseClassifier';
import { ClassificationResult, CleanEmail, TransactionType } from '../../../types/transaction.types';

export class StatementDetector extends BaseClassifier {
    readonly priority = 1;
    readonly name = 'StatementDetector';

    async classify(userId: string, email: CleanEmail): Promise<ClassificationResult | null> {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();

        // Check 1: Must have attachments (PDFs usually)
        if (!email.hasAttachments) return null;

        // Check 2: Statement keywords in subject/body
        const isStatement = /statement|billing|bill statement|monthly statement/i.test(email.subject) ||
            /account statement|card statement/i.test(email.subject);

        if (!isStatement) return null;

        // Check 3: Body indicators
        const hasBillingKeywords = /billing cycle|due date|total amount due|credit limit/i.test(text);

        if (!hasBillingKeywords && !/statement/i.test(email.subject)) return null;

        return {
            type: TransactionType.STATEMENT_TRANSACTION,
            confidence: 0.95,
            metadata: {
                source: 'email_statement',
                hasPdf: true // Simplified check
            }
        };
    }
}
