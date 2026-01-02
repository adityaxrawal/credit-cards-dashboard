import { describe, it, expect } from '@jest/globals';
import { BankChargeExtractor } from '@modules/transactions/services/extraction/extractors/BankChargeExtractor';
import { InterestExtractor } from '@modules/transactions/services/extraction/extractors/InterestExtractor';
import { ChequeExtractor } from '@modules/transactions/services/extraction/extractors/ChequeExtractor';
import { StandingInstructionExtractor } from '@modules/transactions/services/extraction/extractors/StandingInstructionExtractor';
import { CleanEmail, TransactionType, TransactionDirection } from '@shared/types/transaction.types';
import { createMockEmail } from './utils/testHelpers';


describe('BankChargeExtractor', () => {
    it('should extract annual fee', async () => {
        const email = createMockEmail(
            'Annual Fee Charged',
            'Dear Customer, Annual Fee of Rs. 500 has been charged to your credit card ending 1234.'
        );
        const result = await BankChargeExtractor.extract('user-1', email);

        expect(result.type).toBe(TransactionType.BANK_CHARGE);
        expect(result.direction).toBe(TransactionDirection.DEBIT);
        expect(result.amount).toBe(500);
        expect(result.merchant).toBe('Annual Fee');
    });

    it('should extract minimum balance charge', async () => {
        const email = createMockEmail(
            'Minimum Balance Charge',
            'Rs 250 has been debited from your account as minimum balance charge.'
        );
        const result = await BankChargeExtractor.extract('user-1', email);

        expect(result.type).toBe(TransactionType.BANK_CHARGE);
        expect(result.amount).toBe(250);
    });

    it('should extract SMS alert charges', async () => {
        const email = createMockEmail(
            'SMS Alert Charges',
            'INR 15.00 debited as SMS alert fee for the quarter.'
        );
        const result = await BankChargeExtractor.extract('user-1', email);

        expect(result.type).toBe(TransactionType.BANK_CHARGE);
        expect(result.amount).toBe(15);
    });
});

describe('InterestExtractor', () => {
    it('should extract savings interest credit', async () => {
        const email = createMockEmail(
            'Interest Credited',
            'Quarterly interest of Rs. 1234.56 has been credited to your savings account.'
        );
        const result = await InterestExtractor.extract('user-1', email);

        expect(result.type).toBe(TransactionType.INTEREST_CREDIT);
        expect(result.direction).toBe(TransactionDirection.CREDIT);
        expect(result.amount).toBe(1234.56);
    });

    it('should extract FD interest credit', async () => {
        const email = createMockEmail(
            'FD Interest Credit',
            'Fixed Deposit interest Rs 5000 has been credited to your account.'
        );
        const result = await InterestExtractor.extract('user-1', email);

        expect(result.type).toBe(TransactionType.INTEREST_CREDIT);
        expect(result.amount).toBe(5000);
    });

    it('should extract overdraft interest debit', async () => {
        const email = createMockEmail(
            'Overdraft Interest Debited',
            'Overdraft interest of INR 350.00 has been debited from your OD account.'
        );
        const result = await InterestExtractor.extract('user-1', email);

        expect(result.type).toBe(TransactionType.INTEREST_DEBIT);
        expect(result.direction).toBe(TransactionDirection.DEBIT);
    });
});

describe('ChequeExtractor', () => {
    it('should extract cheque deposit', async () => {
        const email = createMockEmail(
            'Cheque Deposited',
            'Cheque No. 123456 for Rs 10000 has been deposited and credited to your account.'
        );
        const result = await ChequeExtractor.extract('user-1', email);

        expect(result.type).toBe(TransactionType.CHEQUE_DEPOSIT);
        expect(result.direction).toBe(TransactionDirection.CREDIT);
        expect(result.amount).toBe(10000);
    });

    it('should extract cheque return/bounce', async () => {
        const email = createMockEmail(
            'Cheque Returned',
            'Cheque No. 654321 worth Rs 5000 has been returned due to insufficient funds.'
        );
        const result = await ChequeExtractor.extract('user-1', email);

        expect(result.type).toBe(TransactionType.CHEQUE_RETURN);
    });
});

describe('StandingInstructionExtractor', () => {
    it('should extract eNACH debit', async () => {
        const email = createMockEmail(
            'eNACH Debit Alert',
            'eNACH debit of Rs 2999 to Netflix has been processed from your account.'
        );
        const result = await StandingInstructionExtractor.extract('user-1', email);

        expect(result.type).toBe(TransactionType.ENACH);
        expect(result.direction).toBe(TransactionDirection.DEBIT);
        expect(result.amount).toBe(2999);
        expect(result.isRecurring).toBe(true);
    });

    it('should extract auto-pay transaction', async () => {
        const email = createMockEmail(
            'Auto Pay Successful',
            'Auto pay processed successfully. Rs 499 debited for Spotify subscription.'
        );
        const result = await StandingInstructionExtractor.extract('user-1', email);

        expect(result.type).toBe(TransactionType.ENACH);
        expect(result.isRecurring).toBe(true);
    });
});
