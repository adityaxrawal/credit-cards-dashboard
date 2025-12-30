/**
 * Remaining Extractor Tests
 * Consolidated tests for smaller extractors
 */

// Mock dependencies
jest.mock('../../utils/infrastructure/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
}));

import { BankAccountDebitExtractor } from '../../services/transactions/extraction/extractors/BankAccountDebitExtractor';
import { BankChargeExtractor } from '../../services/transactions/extraction/extractors/BankChargeExtractor';
import { ChequeExtractor } from '../../services/transactions/extraction/extractors/ChequeExtractor';
import { CreditCardPaymentExtractor } from '../../services/transactions/extraction/extractors/CreditCardPaymentExtractor';
import { CreditCardUPIExtractor } from '../../services/transactions/extraction/extractors/CreditCardUPIExtractor';
import { FeeExtractor } from '../../services/transactions/extraction/extractors/FeeExtractor';
import { InterestExtractor } from '../../services/transactions/extraction/extractors/InterestExtractor';
import { InvestmentExtractor } from '../../services/transactions/extraction/extractors/InvestmentExtractor';
import { RefundExtractor } from '../../services/transactions/extraction/extractors/RefundExtractor';
import { StandingInstructionExtractor } from '../../services/transactions/extraction/extractors/StandingInstructionExtractor';

describe('BankAccountDebitExtractor', () => {
    let extractor: BankAccountDebitExtractor;

    beforeEach(() => {
        extractor = new BankAccountDebitExtractor();
    });

    it('should handle bank debit emails', () => {
        const email = {
            from: 'alerts@hdfcbank.net',
            subject: 'Amount Debited',
            body: 'Rs.5000 debited from your account',
        };
        expect(extractor.canHandle(email)).toBe(true);
    });

    it('should extract debit transaction', async () => {
        const email = {
            messageId: 'msg-1',
            from: 'alerts@hdfcbank.net',
            subject: 'Amount Debited',
            body: 'Rs.5000 debited from your a/c XXXXXX1234 on 15-Jan-24',
        };
        const result = await extractor.extract(email);
        expect(result).toBeDefined();
        expect(result?.direction).toBe('debit');
    });
});

describe('BankChargeExtractor', () => {
    let extractor: BankChargeExtractor;

    beforeEach(() => {
        extractor = new BankChargeExtractor();
    });

    it('should handle bank charge emails', () => {
        const email = {
            from: 'alerts@hdfcbank.net',
            subject: 'Service Charge',
            body: 'Service charge of Rs.500 debited',
        };
        expect(extractor.canHandle(email)).toBe(true);
    });
});

describe('ChequeExtractor', () => {
    let extractor: ChequeExtractor;

    beforeEach(() => {
        extractor = new ChequeExtractor();
    });

    it('should handle cheque deposit emails', () => {
        const email = {
            from: 'alerts@icicibank.com',
            subject: 'Cheque Deposited',
            body: 'Cheque No. 123456 for Rs.10000 deposited',
        };
        expect(extractor.canHandle(email)).toBe(true);
    });

    it('should handle cheque bounce emails', () => {
        const email = {
            from: 'alerts@sbi.co.in',
            subject: 'Cheque Bounced',
            body: 'Your cheque has been returned unpaid',
        };
        expect(extractor.canHandle(email)).toBe(true);
    });
});

describe('CreditCardPaymentExtractor', () => {
    let extractor: CreditCardPaymentExtractor;

    beforeEach(() => {
        extractor = new CreditCardPaymentExtractor();
    });

    it('should handle credit card payment emails', () => {
        const email = {
            from: 'alerts@hdfcbank.net',
            subject: 'Payment Received',
            body: 'Payment of Rs.25000 received for your HDFC Credit Card',
        };
        expect(extractor.canHandle(email)).toBe(true);
    });

    it('should extract payment amount', async () => {
        const email = {
            messageId: 'msg-1',
            from: 'alerts@icicibank.com',
            subject: 'Credit Card Payment',
            body: 'Thank you for your payment of Rs.15,000 towards your credit card ending 4321',
        };
        const result = await extractor.extract(email);
        expect(result).toBeDefined();
        expect(result?.amount).toBe(15000);
    });
});

describe('CreditCardUPIExtractor', () => {
    let extractor: CreditCardUPIExtractor;

    beforeEach(() => {
        extractor = new CreditCardUPIExtractor();
    });

    it('should handle UPI on credit card emails', () => {
        const email = {
            from: 'alerts@hdfcbank.net',
            subject: 'Credit Card UPI Transaction',
            body: 'Rs.500 spent on UPI using your credit card',
        };
        expect(extractor.canHandle(email)).toBe(true);
    });
});

describe('FeeExtractor', () => {
    let extractor: FeeExtractor;

    beforeEach(() => {
        extractor = new FeeExtractor();
    });

    it('should handle fee-related emails', () => {
        const email = {
            from: 'alerts@hdfcbank.net',
            subject: 'Annual Fee',
            body: 'Annual fee of Rs.500 has been charged',
        };
        expect(extractor.canHandle(email)).toBe(true);
    });

    it('should handle late payment fee', () => {
        const email = {
            from: 'alerts@icicibank.com',
            subject: 'Late Payment Fee',
            body: 'Late payment fee of Rs.750 has been charged to your card',
        };
        expect(extractor.canHandle(email)).toBe(true);
    });
});

describe('InterestExtractor', () => {
    let extractor: InterestExtractor;

    beforeEach(() => {
        extractor = new InterestExtractor();
    });

    it('should handle interest credit emails', () => {
        const email = {
            from: 'alerts@hdfcbank.net',
            subject: 'Interest Credit',
            body: 'Interest of Rs.500 has been credited to your savings account',
        };
        expect(extractor.canHandle(email)).toBe(true);
    });

    it('should handle interest debit emails', () => {
        const email = {
            from: 'alerts@sbi.co.in',
            subject: 'Interest Charged',
            body: 'Interest of Rs.1500 has been debited for your loan',
        };
        expect(extractor.canHandle(email)).toBe(true);
    });
});

describe('InvestmentExtractor', () => {
    let extractor: InvestmentExtractor;

    beforeEach(() => {
        extractor = new InvestmentExtractor();
    });

    it('should handle mutual fund purchase emails', () => {
        const email = {
            from: 'notification@bsestarmf.in',
            subject: 'MF Purchase',
            body: 'Your purchase of HDFC Equity Fund for Rs.5000 is successful',
        };
        expect(extractor.canHandle(email)).toBe(true);
    });

    it('should handle SIP debit emails', () => {
        const email = {
            from: 'alerts@cams.com',
            subject: 'SIP Debit',
            body: 'SIP of Rs.10000 debited for ICICI Balanced Fund',
        };
        expect(extractor.canHandle(email)).toBe(true);
    });
});

describe('RefundExtractor', () => {
    let extractor: RefundExtractor;

    beforeEach(() => {
        extractor = new RefundExtractor();
    });

    it('should handle refund emails', () => {
        const email = {
            from: 'alerts@hdfcbank.net',
            subject: 'Refund Credit',
            body: 'Refund of Rs.1500 has been credited to your card',
        };
        expect(extractor.canHandle(email)).toBe(true);
    });

    it('should extract refund amount', async () => {
        const email = {
            messageId: 'msg-1',
            from: 'alerts@icicibank.com',
            subject: 'Refund Processed',
            body: 'Refund of Rs.2,500.00 from Amazon has been credited to your card ending 1234',
        };
        const result = await extractor.extract(email);
        expect(result).toBeDefined();
        expect(result?.amount).toBe(2500);
        expect(result?.direction).toBe('credit');
    });
});

describe('StandingInstructionExtractor', () => {
    let extractor: StandingInstructionExtractor;

    beforeEach(() => {
        extractor = new StandingInstructionExtractor();
    });

    it('should handle standing instruction emails', () => {
        const email = {
            from: 'alerts@hdfcbank.net',
            subject: 'Standing Instruction',
            body: 'Standing instruction of Rs.5000 executed',
        };
        expect(extractor.canHandle(email)).toBe(true);
    });

    it('should handle e-mandate emails', () => {
        const email = {
            from: 'alerts@icicibank.com',
            subject: 'E-Mandate Debit',
            body: 'E-Mandate debit of Rs.1000 executed for Netflix subscription',
        };
        expect(extractor.canHandle(email)).toBe(true);
    });
});
