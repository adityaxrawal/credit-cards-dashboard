import { BankAccountUPICreditExtractor } from '../BankAccountUPICreditExtractor';
import { CreditCardSpendExtractor } from '../CreditCardSpendExtractor';
import { CleanEmail, TransactionType, TransactionDirection, InstrumentType } from '../../../../types/transaction.types';

const mockEmail = (subject: string, body: string): CleanEmail => ({
    id: 'test-id',
    internalDate: 1234567890,
    subject,
    from: 'test@bank.com',
    cleanedBody: body,
    hasAttachments: false
});

describe('Refined Extraction Tests', () => {
    describe('BankAccountUPICreditExtractor', () => {
        it('should extract amount with ₹ symbol', async () => {
            const email = mockEmail('Credit Alert', 'Received ₹500.00 from John Doe');
            const result = await BankAccountUPICreditExtractor.extract('user-1', email);
            expect(result.amount).toBe(500.00);
        });

        it('should extract amount with Rs. prefix', async () => {
            const email = mockEmail('Credit Alert', 'Received Rs. 1,200 from John Doe');
            const result = await BankAccountUPICreditExtractor.extract('user-1', email);
            expect(result.amount).toBe(1200.00);
        });

        it('should extract amount with INR prefix', async () => {
            const email = mockEmail('Credit Alert', 'Received INR 50.50 from John Doe');
            const result = await BankAccountUPICreditExtractor.extract('user-1', email);
            expect(result.amount).toBe(50.50);
        });
    });

    describe('CreditCardSpendExtractor', () => {
        it('should extract amount with "spent" keyword', async () => {
            const email = mockEmail('Transaction Alert', 'You spent Rs. 999.00 at Amazon');
            const result = await CreditCardSpendExtractor.extract('user-1', email);
            expect(result.amount).toBe(999.00);
        });

        it('should extract amount with "Amount" fallback', async () => {
            const email = mockEmail('Transaction Alert', 'Amount Rs. 2000.00 debited from card');
            const result = await CreditCardSpendExtractor.extract('user-1', email);
            expect(result.amount).toBe(2000.00);
        });

        it('should extract amount with "for" fallback', async () => {
            const email = mockEmail('Transaction Alert', 'Transaction for Rs. 150.00 successful');
            const result = await CreditCardSpendExtractor.extract('user-1', email);
            expect(result.amount).toBe(150.00);
        });
    });
});
