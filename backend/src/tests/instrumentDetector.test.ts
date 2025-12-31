import { describe, it, expect } from '@jest/globals';
import { InstrumentDetector, DetectedInstrument } from '../services/transactions/extraction/InstrumentDetector';
import { InstrumentType } from '../types/transaction.types';

describe('InstrumentDetector', () => {
    describe('detectFromContent', () => {
        it('should detect credit card last 4 digits', () => {
            const instruments = InstrumentDetector.detectFromContent(
                'Transaction on Credit Card',
                'Your HDFC Bank Credit Card ending XXXX1234 has been used for INR 500'
            );

            expect(instruments.length).toBeGreaterThan(0);
            const card = instruments.find(i => i.type === InstrumentType.CREDIT_CARD);
            expect(card?.cardLast4).toBe('1234');
        });

        it('should detect debit card', () => {
            const instruments = InstrumentDetector.detectFromContent(
                'Debit Card Transaction',
                'Your Debit Card ending ****5678 was used at ATM'
            );

            const card = instruments.find(i => i.type === InstrumentType.DEBIT_CARD);
            expect(card?.cardLast4).toBe('5678');
        });

        it('should detect UPI VPA', () => {
            const instruments = InstrumentDetector.detectFromContent(
                'UPI Transfer',
                'Payment of Rs 100 received from user@okicici to your VPA yourname@upi'
            );

            const upi = instruments.find(i => i.type === InstrumentType.UPI);
            expect(upi?.upiVpa).toBeDefined();
        });

        it('should detect masked account number', () => {
            const instruments = InstrumentDetector.detectFromContent(
                'Account Credit',
                'Rs 50000 has been credited to your A/C XXXX1234'
            );

            const account = instruments.find(i => i.type === InstrumentType.BANK_ACCOUNT);
            expect(account?.accountMasked).toContain('1234');
        });

        it('should detect bank from domain', () => {
            const instruments = InstrumentDetector.detectFromContent(
                'Transaction Alert',
                'Your card ending 1234 was used',
                'hdfcbank.com'
            );

            expect(instruments[0]?.bankName).toBe('HDFC Bank');
        });

        it('should detect bank from content', () => {
            const instruments = InstrumentDetector.detectFromContent(
                'ICICI Bank Alert',
                'Your ICICI Bank account XXXX1234 has been debited'
            );

            const account = instruments.find(i => i.bankName);
            expect(account?.bankName).toBe('ICICI Bank');
        });
    });

    describe('inferInstrumentType', () => {
        it('should infer credit card for cc_spend', () => {
            const type = InstrumentDetector.inferInstrumentType('cc_spend', []);
            expect(type).toBe(InstrumentType.CREDIT_CARD);
        });

        it('should infer UPI for bank_upi_debit', () => {
            const type = InstrumentDetector.inferInstrumentType('bank_upi_debit', []);
            expect(type).toBe(InstrumentType.UPI);
        });

        it('should use detected instrument over inference', () => {
            const detected = [{
                type: InstrumentType.CREDIT_CARD,
                cardLast4: '1234',
                confidence: 0.9
            }];
            const type = InstrumentDetector.inferInstrumentType('bank_debit', detected);
            expect(type).toBe(InstrumentType.CREDIT_CARD);
        });
    });

    describe('extractIFSC', () => {
        it('should extract IFSC code', () => {
            const ifsc = InstrumentDetector.extractIFSC('IFSC: HDFC0001234');
            expect(ifsc).toBe('HDFC0001234');
        });
    });
});
