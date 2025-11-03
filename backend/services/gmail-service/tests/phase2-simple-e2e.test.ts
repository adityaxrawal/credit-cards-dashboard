/**
 * Phase 2 Simplified E2E Test
 * Tests classification → extraction flow
 */

import { emailClassifier } from "../src/classifier/email-classifier";
import { transactionExtractor } from "../src/extractor/transaction-extractor";
import { historicalScanner } from "../src/scanner/historical-scanner";

describe("Phase 2 E2E - Classification and Extraction", () => {
  describe("Complete Transaction Flow", () => {
    it("should classify and extract HDFC transaction", async () => {
      const email: any = {
        id: "test-1",
        threadId: "thread-1",
        historyId: "12345",
        from: "alerts@hdfcbank.net",
        to: "user@example.com",
        subject: "Transaction Alert",
        bodyPlain: "Your HDFC Bank Credit Card xx1234 used for INR 2,500.00 at Amazon on 15-Jan-2024",
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
        date: "2024-01-15",
        snippet: "Transaction alert",
        internalDate: Date.now().toString(),
      };

      // Classify
      const classification = await emailClassifier.classify(email);
      expect(classification.classification).toBe("transaction");
      expect(classification.bankName).toBe("HDFC");

      // Extract
      const extraction = await transactionExtractor.extract(email, classification.bankName);
      expect(extraction.success).toBe(true);
      expect(extraction.transaction?.amount).toBe(2500);
      expect(extraction.transaction?.merchant).toBe("Amazon");
    });

    it("should classify and extract ICICI transaction", async () => {
      const email: any = {
        id: "test-2",
        from: "credit.cards@icicibank.com",
        to: "user@example.com",
        subject: "Purchase Alert",
        bodyPlain: "Purchase of INR 3,250.75 using ICICI Bank Credit Card ending 5678 at Swiggy",
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
      };

      const classification = await emailClassifier.classify(email);
      expect(classification.classification).toBe("transaction");

      const extraction = await transactionExtractor.extract(email, classification.bankName);
      expect(extraction.success).toBe(true);
      expect(extraction.transaction?.amount).toBe(3250.75);
    });
  });

  describe("Historical Scanner", () => {
    it("should start and track scan job", async () => {
      const config = {
        userId: "test-user",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
      };

      const jobId = await historicalScanner.startScan(config);
      expect(jobId).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 500));

      const progress = await historicalScanner.getProgress(jobId);
      expect(progress).toBeDefined();
      expect(progress?.jobId).toBe(jobId);
    });

    it("should pause and resume scan", async () => {
      const config = {
        userId: "test-user-2",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
      };

      const jobId = await historicalScanner.startScan(config);
      await historicalScanner.pauseScan(jobId);

      let progress = await historicalScanner.getProgress(jobId);
      expect(progress?.status).toBe("paused");

      await historicalScanner.resumeScan(jobId);
      progress = await historicalScanner.getProgress(jobId);
      expect(progress?.status).toBe("running");
    });
  });

  describe("Multiple Banks Integration", () => {
    const testCases = [
      {
        bank: "HDFC",
        email: "alerts@hdfcbank.net",
        body: "HDFC Bank Card xx1234 used for Rs 1,000 at Shop",
        expectedAmount: 1000,
      },
      {
        bank: "ICICI",
        email: "credit.cards@icicibank.com",
        body: "Purchase of Rs 2,000 using ICICI Card ending 5678",
        expectedAmount: 2000,
      },
      {
        bank: "SBI",
        email: "sbicard.alert@sbi.co.in",
        body: "SBI Card ending 9012 used for Rs. 3,000 at Store",
        expectedAmount: 3000,
      },
    ];

    testCases.forEach(({ bank, email, body, expectedAmount }) => {
      it(`should handle ${bank} transactions`, async () => {
        const mockEmail: any = {
          id: `test-${bank}`,
          from: email,
          to: "user@example.com",
          subject: "Transaction Alert",
          bodyPlain: body,
          bodyHtml: "",
          labels: ["INBOX"],
          timestamp: new Date(),
        };

        const classification = await emailClassifier.classify(mockEmail);
        expect(classification.classification).toBe("transaction");
        expect(classification.bankName).toBe(bank);

        const extraction = await transactionExtractor.extract(mockEmail, bank);
        expect(extraction.success).toBe(true);
        expect(extraction.transaction?.amount).toBe(expectedAmount);
      });
    });
  });

  describe("Error Cases", () => {
    it("should not extract from promotional emails", async () => {
      const email: any = {
        id: "promo-1",
        from: "marketing@bank.com",
        to: "user@example.com",
        subject: "Special Offer!",
        bodyPlain: "Get 10% cashback on your next purchase!",
        bodyHtml: "",
        labels: ["INBOX", "CATEGORY_PROMOTIONS"],
        timestamp: new Date(),
      };

      const classification = await emailClassifier.classify(email);
      expect(classification.classification).toBe("promotional");

      const extraction = await transactionExtractor.extract(email);
      expect(extraction.success).toBe(false);
    });

    it("should handle invalid extraction gracefully", async () => {
      const email: any = {
        id: "invalid-1",
        from: "unknown@test.com",
        to: "user@example.com",
        subject: "Random Email",
        bodyPlain: "This is not a transaction email",
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
      };

      const extraction = await transactionExtractor.extract(email);
      expect(extraction.success).toBe(false);
    });
  });
});
