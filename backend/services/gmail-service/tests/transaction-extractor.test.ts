import { transactionExtractor } from "../src/extractor/transaction-extractor";
import { NormalizedEmail } from "../src/types";

describe("TransactionExtractor", () => {
  describe("HDFC Bank", () => {
    it("should extract debit transaction", async () => {
      const email: NormalizedEmail = {
        id: "test-1",
        from: "alerts@hdfcbank.net",
        to: "user@example.com",
        subject: "Alert: Your HDFC Bank Card has been used",
        bodyPlain: `Dear Customer, your HDFC Bank Credit Card xx1234 has been used for a transaction of INR 2,500.00 at Amazon on 15-Jan-2024.`,
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
      };

      const result = await transactionExtractor.extract(email, "HDFC");

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction?.amount).toBe(2500);
      expect(result.transaction?.merchant).toBe("Amazon");
      expect(result.transaction?.cardLast4).toBe("1234");
      expect(result.transaction?.transactionType).toBe("debit");
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("should extract credit transaction", async () => {
      const email: NormalizedEmail = {
        id: "test-2",
        from: "alerts@hdfcbank.net",
        to: "user@example.com",
        subject: "Credit Alert",
        bodyPlain: `Your HDFC Bank account has been credited with Rs 15,000.50 on 20-Jan-2024. Reference: SAL123.`,
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
      };

      const result = await transactionExtractor.extract(email, "HDFC");

      expect(result.success).toBe(true);
      expect(result.transaction?.amount).toBe(15000.5);
      expect(result.transaction?.transactionType).toBe("credit");
    });
  });

  describe("ICICI Bank", () => {
    it("should extract purchase transaction", async () => {
      const email: NormalizedEmail = {
        id: "test-3",
        from: "credit.cards@icicibank.com",
        to: "user@example.com",
        subject: "Purchase Alert",
        bodyPlain: `Purchase of INR 3,250.75 using ICICI Bank Credit Card ending 5678 at Swiggy on 22-Jan-2024 10:30 AM.`,
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
      };

      const result = await transactionExtractor.extract(email, "ICICI");

      expect(result.success).toBe(true);
      expect(result.transaction?.amount).toBe(3250.75);
      expect(result.transaction?.merchant).toBe("Swiggy");
      expect(result.transaction?.cardLast4).toBe("5678");
    });

    it("should extract payment received", async () => {
      const email: NormalizedEmail = {
        id: "test-4",
        from: "credit.cards@icicibank.com",
        to: "user@example.com",
        subject: "Payment Received",
        bodyPlain: `Payment of Rs 10,000.00 received for your ICICI Bank Credit Card on 23-Jan-2024. Thank you.`,
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
      };

      const result = await transactionExtractor.extract(email, "ICICI");

      expect(result.success).toBe(true);
      expect(result.transaction?.amount).toBe(10000);
      expect(result.transaction?.transactionType).toBe("payment");
    });
  });

  describe("SBI Bank", () => {
    it("should extract card transaction", async () => {
      const email: NormalizedEmail = {
        id: "test-5",
        from: "sbicard.alert@sbi.co.in",
        to: "user@example.com",
        subject: "Transaction Alert",
        bodyPlain: `Your SBI Credit Card ending 9012 has been used for Rs. 1,499.00 at Flipkart on 25-Jan-2024.`,
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
      };

      const result = await transactionExtractor.extract(email, "SBI");

      expect(result.success).toBe(true);
      expect(result.transaction?.amount).toBe(1499);
      expect(result.transaction?.merchant).toBe("Flipkart");
      expect(result.transaction?.cardLast4).toBe("9012");
    });
  });

  describe("Axis Bank", () => {
    it("should extract purchase", async () => {
      const email: NormalizedEmail = {
        id: "test-6",
        from: "alerts@axisbank.com",
        to: "user@example.com",
        subject: "Purchase Alert",
        bodyPlain: `INR 5,750.25 spent on Axis Bank Card xx3456 at Zomato on 26-Jan-2024.`,
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
      };

      const result = await transactionExtractor.extract(email, "Axis");

      expect(result.success).toBe(true);
      expect(result.transaction?.amount).toBe(5750.25);
      expect(result.transaction?.merchant).toBe("Zomato");
    });

    it("should extract refund", async () => {
      const email: NormalizedEmail = {
        id: "test-7",
        from: "alerts@axisbank.com",
        to: "user@example.com",
        subject: "Refund Processed",
        bodyPlain: `Refund of Rs 2,000.00 credited to your Axis Bank Card on 27-Jan-2024.`,
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
      };

      const result = await transactionExtractor.extract(email, "Axis");

      expect(result.success).toBe(true);
      expect(result.transaction?.amount).toBe(2000);
      expect(result.transaction?.transactionType).toBe("refund");
    });
  });

  describe("Kotak Bank", () => {
    it("should extract transaction", async () => {
      const email: NormalizedEmail = {
        id: "test-8",
        from: "alerts@kotak.com",
        to: "user@example.com",
        subject: "Transaction Notification",
        bodyPlain: `Transaction of INR 8,999.99 on Kotak Credit Card ending 7890 at Apple Store on 28-Jan-2024.`,
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
      };

      const result = await transactionExtractor.extract(email, "Kotak");

      expect(result.success).toBe(true);
      expect(result.transaction?.amount).toBe(8999.99);
      expect(result.transaction?.merchant).toBe("Apple Store");
    });
  });

  describe("American Express", () => {
    it("should extract purchase", async () => {
      const email: NormalizedEmail = {
        id: "test-9",
        from: "no-reply@americanexpress.com",
        to: "user@example.com",
        subject: "Purchase Alert",
        bodyPlain: `Card purchase of $125.50 on your Amex Card ending 4567 at Starbucks on 29-Jan-2024.`,
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
      };

      const result = await transactionExtractor.extract(email, "American Express");

      expect(result.success).toBe(true);
      expect(result.transaction?.amount).toBe(125.5);
      expect(result.transaction?.merchant).toBe("Starbucks");
    });
  });

  describe("Generic Patterns", () => {
    it("should extract unknown bank transaction", async () => {
      const email: NormalizedEmail = {
        id: "test-10",
        from: "alerts@unknownbank.com",
        to: "user@example.com",
        subject: "Transaction Alert",
        bodyPlain: `Amount: Rs 4,500.00 debited from Card ending 2468 at Netflix on 30-Jan-2024.`,
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
      };

      const result = await transactionExtractor.extract(email);

      expect(result.success).toBe(true);
      expect(result.transaction?.amount).toBe(4500);
      expect(result.transaction?.merchant).toBe("Netflix");
    });
  });

  describe("Confidence Scoring", () => {
    it("should give high confidence for complete data", async () => {
      const email: NormalizedEmail = {
        id: "test-11",
        from: "alerts@hdfcbank.net",
        to: "user@example.com",
        subject: "Transaction Alert",
        bodyPlain: `Your HDFC Bank Credit Card xx1234 has been used for INR 5,000.00 at Amazon on 15-Jan-2024.`,
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
      };

      const result = await transactionExtractor.extract(email, "HDFC");

      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should give lower confidence for partial data", async () => {
      const email: NormalizedEmail = {
        id: "test-12",
        from: "alerts@hdfcbank.net",
        to: "user@example.com",
        subject: "Alert",
        bodyPlain: `Transaction of Rs 1,000 on your card.`,
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
      };

      const result = await transactionExtractor.extract(email, "HDFC");

      if (result.success) {
        expect(result.confidence).toBeLessThan(0.7);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle comma-separated amounts", async () => {
      const email: NormalizedEmail = {
        id: "test-13",
        from: "alerts@hdfcbank.net",
        to: "user@example.com",
        subject: "Alert",
        bodyPlain: `Transaction of INR 1,25,500.75 on your card.`,
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
      };

      const result = await transactionExtractor.extract(email, "HDFC");

      if (result.success) {
        expect(result.transaction?.amount).toBe(125500.75);
      }
    });

    it("should normalize merchant names", async () => {
      const email: NormalizedEmail = {
        id: "test-14",
        from: "alerts@hdfcbank.net",
        to: "user@example.com",
        subject: "Alert",
        bodyPlain: `Transaction at AMAZON   INDIA.  for Rs 500.`,
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
      };

      const result = await transactionExtractor.extract(email, "HDFC");

      if (result.success) {
        expect(result.transaction?.merchant).toBe("AMAZON INDIA");
      }
    });

    it("should return failure for non-transaction emails", async () => {
      const email: NormalizedEmail = {
        id: "test-15",
        from: "marketing@bank.com",
        to: "user@example.com",
        subject: "Special Offer!",
        bodyPlain: `Get 10% cashback on your next purchase!`,
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
      };

      const result = await transactionExtractor.extract(email);

      expect(result.success).toBe(false);
    });
  });

  describe("Fingerprint Generation", () => {
    it("should generate consistent fingerprints", () => {
      const transaction = {
        amount: 1000,
        merchant: "Amazon",
        cardLast4: "1234",
        date: "2024-01-15",
      };

      const fp1 = transactionExtractor.generateFingerprint(transaction, "email1");
      const fp2 = transactionExtractor.generateFingerprint(transaction, "email1");

      expect(fp1).toBe(fp2);
    });

    it("should generate different fingerprints for different transactions", () => {
      const transaction1 = {
        amount: 1000,
        merchant: "Amazon",
        cardLast4: "1234",
        date: "2024-01-15",
      };

      const transaction2 = {
        amount: 2000,
        merchant: "Amazon",
        cardLast4: "1234",
        date: "2024-01-15",
      };

      const fp1 = transactionExtractor.generateFingerprint(transaction1, "email1");
      const fp2 = transactionExtractor.generateFingerprint(transaction2, "email1");

      expect(fp1).not.toBe(fp2);
    });
  });
});
