import { BankParsers } from '../BankParsers';
import { DateParser } from '../DateParser';

describe('BankParsers', () => {
  const mockDate = new Date('2023-11-14T10:00:00.000Z');

  describe('HDFC Parser', () => {
    const parser = BankParsers.find(p => p.name === 'HDFC')!;

    it('should extract transaction details correctly', () => {
      const text = `
        Dear Customer,
        Rs. 1,234.50 spent on HDFC Bank Credit Card ending 1234 at SWIGGY on 14-11-2023 10:30:00.
        Available Limit: Rs. 50,000.
        Ref No: 1234567890
      `;
      const subject = 'Transaction Alert: HDFC Bank Credit Card';
      const sender = 'alerts@hdfcbank.net';

      const result = parser.parse(text, subject, sender, mockDate);

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(1234.50);
      expect(result?.merchant).toBe('SWIGGY');
      expect(result?.lastFourDigits).toBe('1234');
      expect(result?.cardName).toBe('HDFC Swiggy');
      expect(result?.exactTimestamp).toBeInstanceOf(Date);
      expect(result?.exactTimestamp?.getDate()).toBe(14);
      expect(result?.exactTimestamp?.getMonth()).toBe(10); // November is 10
      expect(result?.exactTimestamp?.getFullYear()).toBe(2023);
      expect(result?.referenceNumber).toBe('1234567890');
    });
  });

  describe('SBI Parser', () => {
    const parser = BankParsers.find(p => p.name === 'SBI')!;

    it('should extract transaction details correctly', () => {
      const text = `
        Dear Cardholder,
        Transaction of Rs 5,000.00 made on SBI Credit Card ending XX1234 at AMAZON on 14 Nov 2023.
        Txn ID: SBI123456789
      `;
      const subject = 'Transaction Alert';
      const sender = 'sbicard@sbicard.com';

      const result = parser.parse(text, subject, sender, mockDate);

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(5000.00);
      expect(result?.merchant).toBe('AMAZON');
      expect(result?.lastFourDigits).toBe('1234');
      expect(result?.referenceNumber).toBe('SBI123456789');
    });
  });

  describe('ICICI Parser', () => {
    const parser = BankParsers.find(p => p.name === 'ICICI')!;

    it('should extract transaction details correctly', () => {
      const text = `
        Dear Customer,
        Your ICICI Bank Credit Card XX1234 has been used for a transaction of INR 2,500.00 at FLIPKART on November 14, 2023.
        Reference Number: 9876543210
      `;
      const subject = 'Transaction Alert';
      const sender = 'alerts@icicibank.com';

      const result = parser.parse(text, subject, sender, mockDate);

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(2500.00);
      expect(result?.merchant).toBe('FLIPKART');
      expect(result?.lastFourDigits).toBe('1234');
      expect(result?.referenceNumber).toBe('9876543210');
    });
  });

  describe('International Transaction', () => {
    const parser = BankParsers.find(p => p.name === 'HDFC')!;

    it('should extract international transaction details', () => {
      const text = `
        Dear Customer,
        USD 10.00 spent on HDFC Bank Credit Card ending 1234 at GOOGLE *SERVICES on 14-11-2023.
        Ref No: INT123
      `;
      const subject = 'International Transaction Alert';
      const sender = 'alerts@hdfcbank.net';

      const result = parser.parse(text, subject, sender, mockDate);

      expect(result).not.toBeNull();
      expect(result?.currencyCode).toBe('USD');
      expect(result?.originalAmount).toBe(10.00);
      expect(result?.isInternational).toBe(true);
      expect(result?.referenceNumber).toBe('INT123');
    });
  });
});
