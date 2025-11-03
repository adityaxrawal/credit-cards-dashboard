import { historicalScanner } from "../src/scanner/historical-scanner";
import { gmailClient } from "../src/gmail-client";
import { emailFetcher } from "../src/email-fetcher";

// Mock dependencies
jest.mock("../src/gmail-client");
jest.mock("../src/email-fetcher");
jest.mock("../src/classifier/email-classifier");
jest.mock("../src/extractor/transaction-extractor");

describe("HistoricalScanner", () => {
  const mockUserId = "user-123";
  const mockJobId = "job-456";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("startScan", () => {
    it("should create scan job and start processing", async () => {
      const config = {
        userId: mockUserId,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        labelFilter: "INBOX",
      };

      const jobId = await historicalScanner.startScan(config);

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe("string");
    });

    it("should handle scan configuration without label filter", async () => {
      const config = {
        userId: mockUserId,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
      };

      const jobId = await historicalScanner.startScan(config);

      expect(jobId).toBeDefined();
    });
  });

  describe("getProgress", () => {
    it("should return null for non-existent job", async () => {
      const progress = await historicalScanner.getProgress("invalid-job-id");

      expect(progress).toBeNull();
    });

    it("should return progress for existing job", async () => {
      // First create a job
      const config = {
        userId: mockUserId,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
      };

      const jobId = await historicalScanner.startScan(config);

      // Wait a bit for job to be created
      await new Promise((resolve) => setTimeout(resolve, 100));

      const progress = await historicalScanner.getProgress(jobId);

      expect(progress).toBeDefined();
      if (progress) {
        expect(progress.jobId).toBe(jobId);
        expect(progress.status).toBeDefined();
        expect(progress.totalMessages).toBeGreaterThanOrEqual(0);
        expect(progress.processedMessages).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("pauseScan", () => {
    it("should pause running scan", async () => {
      const config = {
        userId: mockUserId,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
      };

      const jobId = await historicalScanner.startScan(config);

      await historicalScanner.pauseScan(jobId);

      const progress = await historicalScanner.getProgress(jobId);

      expect(progress?.status).toBe("paused");
    });
  });

  describe("resumeScan", () => {
    it("should resume paused scan", async () => {
      const config = {
        userId: mockUserId,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
      };

      const jobId = await historicalScanner.startScan(config);

      // Pause first
      await historicalScanner.pauseScan(jobId);

      // Then resume
      await historicalScanner.resumeScan(jobId);

      const progress = await historicalScanner.getProgress(jobId);

      expect(progress?.status).toBe("running");
    });

    it("should throw error for non-existent job", async () => {
      await expect(
        historicalScanner.resumeScan("invalid-job-id")
      ).rejects.toThrow();
    });
  });

  describe("Batch Processing", () => {
    it("should process messages in batches", async () => {
      // Mock Gmail client to return message IDs
      (gmailClient.initializeForUser as jest.Mock).mockResolvedValue({
        users: { messages: { list: jest.fn() } },
      });

      (emailFetcher.listMessages as jest.Mock).mockResolvedValue([
        "msg1",
        "msg2",
        "msg3",
      ]);

      (emailFetcher.fetchEmail as jest.Mock).mockResolvedValue({
        id: "msg1",
        from: "alerts@hdfcbank.net",
        to: "user@example.com",
        subject: "Transaction Alert",
        bodyPlain: "Transaction of Rs 1000",
        bodyHtml: "",
        labels: ["INBOX"],
        timestamp: new Date(),
      });

      const config = {
        userId: mockUserId,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
      };

      const jobId = await historicalScanner.startScan(config);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const progress = await historicalScanner.getProgress(jobId);

      expect(progress).toBeDefined();
    });
  });

  describe("Checkpoint System", () => {
    it("should save checkpoints during processing", async () => {
      (gmailClient.initializeForUser as jest.Mock).mockResolvedValue({
        users: { messages: { list: jest.fn() } },
      });

      // Mock 200 messages to trigger checkpoint
      const messageIds = Array.from({ length: 200 }, (_, i) => `msg${i}`);
      (emailFetcher.listMessages as jest.Mock).mockResolvedValue(messageIds);

      const config = {
        userId: mockUserId,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
      };

      const jobId = await historicalScanner.startScan(config);

      // Wait for some processing
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const progress = await historicalScanner.getProgress(jobId);

      expect(progress).toBeDefined();
      // Should have processed some messages
      if (progress) {
        expect(progress.processedMessages).toBeGreaterThan(0);
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle Gmail API errors gracefully", async () => {
      (gmailClient.initializeForUser as jest.Mock).mockRejectedValue(
        new Error("Gmail API error")
      );

      const config = {
        userId: mockUserId,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
      };

      const jobId = await historicalScanner.startScan(config);

      // Wait for error
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const progress = await historicalScanner.getProgress(jobId);

      expect(progress?.status).toBe("failed");
    });

    it("should continue processing after individual message failures", async () => {
      (gmailClient.initializeForUser as jest.Mock).mockResolvedValue({
        users: { messages: { list: jest.fn() } },
      });

      (emailFetcher.listMessages as jest.Mock).mockResolvedValue([
        "msg1",
        "msg2",
        "msg3",
      ]);

      // First message fails, others succeed
      (emailFetcher.fetchEmail as jest.Mock)
        .mockRejectedValueOnce(new Error("Fetch error"))
        .mockResolvedValue({
          id: "msg2",
          from: "test@test.com",
          to: "user@example.com",
          subject: "Test",
          bodyPlain: "Test",
          bodyHtml: "",
          labels: [],
          timestamp: new Date(),
        });

      const config = {
        userId: mockUserId,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
      };

      const jobId = await historicalScanner.startScan(config);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const progress = await historicalScanner.getProgress(jobId);

      if (progress) {
        expect(progress.failedMessages).toBeGreaterThan(0);
        expect(progress.processedMessages).toBeGreaterThan(progress.failedMessages);
      }
    });
  });

  describe("Deduplication", () => {
    it("should skip already processed messages", async () => {
      (gmailClient.initializeForUser as jest.Mock).mockResolvedValue({
        users: { messages: { list: jest.fn() } },
      });

      (emailFetcher.listMessages as jest.Mock).mockResolvedValue(["msg1"]);

      (emailFetcher.fetchEmail as jest.Mock).mockResolvedValue({
        id: "msg1",
        from: "test@test.com",
        to: "user@example.com",
        subject: "Test",
        bodyPlain: "Test",
        bodyHtml: "",
        labels: [],
        timestamp: new Date(),
      });

      const config = {
        userId: mockUserId,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
      };

      // Process first time
      const jobId1 = await historicalScanner.startScan(config);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Process second time (should detect duplicates)
      const jobId2 = await historicalScanner.startScan(config);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const progress = await historicalScanner.getProgress(jobId2);

      if (progress) {
        expect(progress.duplicateMessages).toBeGreaterThan(0);
      }
    });
  });
});
