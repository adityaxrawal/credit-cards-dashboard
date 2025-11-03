import { RecurringTransactionService } from "../src/services/recurring-transaction.service";
import { createClient } from "@supabase/supabase-js";
import { addDays, addMonths, startOfDay } from "date-fns";

// Mock Supabase
jest.mock("@supabase/supabase-js");

const mockSupabase = {
  from: jest.fn(),
};

const mockQuery = {
  insert: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn(),
  limit: jest.fn().mockReturnThis(),
};

mockSupabase.from.mockReturnValue(mockQuery);
(createClient as jest.Mock).mockReturnValue(mockSupabase);

describe("RecurringTransactionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createRecurringTransaction", () => {
    it("should create a new recurring transaction with valid data", async () => {
      const mockData = {
        user_id: "user-123",
        card_id: "card-456",
        merchant_name: "Netflix",
        amount: 999,
        frequency: "monthly" as const,
        start_date: new Date().toISOString(),
        timezone: "Asia/Kolkata",
        notification_enabled: true,
        auto_execute: true,
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "rec-789", ...mockData, execution_count: 0 },
        error: null,
      });

      const result =
        await RecurringTransactionService.createRecurringTransaction(mockData);

      expect(result).toBeDefined();
      expect(result.id).toBe("rec-789");
      expect(mockSupabase.from).toHaveBeenCalledWith("recurring_transactions");
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it("should throw error for invalid data", async () => {
      const invalidData = {
        user_id: "user-123",
        card_id: "card-456",
        merchant_name: "",
        amount: -100,
        frequency: "monthly" as const,
        start_date: new Date().toISOString(),
        timezone: "Asia/Kolkata",
        notification_enabled: true,
        auto_execute: true,
      };

      await expect(
        RecurringTransactionService.createRecurringTransaction(invalidData)
      ).rejects.toThrow();
    });

    it("should calculate next execution date correctly for monthly frequency", async () => {
      const startDate = new Date("2025-01-15");
      const mockData = {
        user_id: "user-123",
        card_id: "card-456",
        merchant_name: "Spotify",
        amount: 199,
        frequency: "monthly" as const,
        start_date: startDate.toISOString(),
        timezone: "Asia/Kolkata",
        notification_enabled: true,
        auto_execute: true,
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: "rec-789",
          ...mockData,
          execution_count: 0,
          next_execution: addMonths(startDate, 1).toISOString(),
        },
        error: null,
      });

      const result =
        await RecurringTransactionService.createRecurringTransaction(mockData);
      expect(result.next_execution).toBeDefined();
    });
  });

  describe("updateRecurringTransaction", () => {
    it("should update recurring transaction successfully", async () => {
      const existingData = {
        id: "rec-123",
        user_id: "user-123",
        frequency: "monthly" as const,
        next_execution: new Date().toISOString(),
        metadata: {},
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: existingData,
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { ...existingData, amount: 1299 },
        error: null,
      });

      const result =
        await RecurringTransactionService.updateRecurringTransaction(
          "rec-123",
          "user-123",
          { amount: 1299 }
        );

      expect(result).toBeDefined();
      expect(mockSupabase.update).toHaveBeenCalled();
    });
  });

  describe("pauseRecurringTransaction", () => {
    it("should pause active transaction", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "rec-123", status: "paused" },
        error: null,
      });

      await RecurringTransactionService.pauseRecurringTransaction(
        "rec-123",
        "user-123"
      );

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "paused" })
      );
    });
  });

  describe("resumeRecurringTransaction", () => {
    it("should resume paused transaction", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "rec-123", status: "active" },
        error: null,
      });

      await RecurringTransactionService.resumeRecurringTransaction(
        "rec-123",
        "user-123"
      );

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "active" })
      );
    });
  });

  describe("cancelRecurringTransaction", () => {
    it("should cancel transaction", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "rec-123", status: "cancelled" },
        error: null,
      });

      await RecurringTransactionService.cancelRecurringTransaction(
        "rec-123",
        "user-123"
      );

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "cancelled" })
      );
    });
  });

  describe("getUserRecurringTransactions", () => {
    it("should fetch all user recurring transactions", async () => {
      const mockTransactions = [
        { id: "rec-1", merchant_name: "Netflix", status: "active" },
        { id: "rec-2", merchant_name: "Spotify", status: "paused" },
      ];

      mockSupabase.order.mockResolvedValueOnce({
        data: mockTransactions,
        error: null,
      });

      const result =
        await RecurringTransactionService.getUserRecurringTransactions(
          "user-123"
        );

      expect(result).toHaveLength(2);
      expect(mockSupabase.from).toHaveBeenCalledWith("recurring_transactions");
    });

    it("should filter by status when provided", async () => {
      const mockTransactions = [
        { id: "rec-1", merchant_name: "Netflix", status: "active" },
      ];

      mockSupabase.order.mockResolvedValueOnce({
        data: mockTransactions,
        error: null,
      });

      const result =
        await RecurringTransactionService.getUserRecurringTransactions(
          "user-123",
          "active"
        );

      expect(result).toHaveLength(1);
      expect(mockSupabase.eq).toHaveBeenCalledWith("status", "active");
    });
  });

  describe("processDueRecurringTransactions", () => {
    it("should process due transactions successfully", async () => {
      const dueTransaction = {
        id: "rec-123",
        user_id: "user-123",
        card_id: "card-456",
        merchant_name: "Netflix",
        amount: 999,
        frequency: "monthly" as const,
        status: "active",
        next_execution: new Date(Date.now() - 1000).toISOString(),
        execution_count: 5,
        auto_execute: true,
        notification_enabled: true,
        metadata: {},
      };

      mockSupabase.lte.mockResolvedValueOnce({
        data: [dueTransaction],
        error: null,
      });

      // Mock duplicate check
      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock transaction creation
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "tx-789" },
        error: null,
      });

      const result =
        await RecurringTransactionService.processDueRecurringTransactions();

      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
    });

    it("should skip duplicate executions", async () => {
      const dueTransaction = {
        id: "rec-123",
        user_id: "user-123",
        card_id: "card-456",
        merchant_name: "Netflix",
        amount: 999,
        frequency: "monthly" as const,
        status: "active",
        next_execution: new Date(Date.now() - 1000).toISOString(),
        execution_count: 5,
        auto_execute: true,
        notification_enabled: true,
        metadata: {},
      };

      mockSupabase.lte.mockResolvedValueOnce({
        data: [dueTransaction],
        error: null,
      });

      // Mock existing execution (duplicate)
      mockSupabase.limit.mockResolvedValueOnce({
        data: [{ id: "exec-123" }],
        error: null,
      });

      const result =
        await RecurringTransactionService.processDueRecurringTransactions();

      expect(result.processed).toBe(1);
      // Transaction creation should not be called
    });

    it("should handle max executions reached", async () => {
      const dueTransaction = {
        id: "rec-123",
        user_id: "user-123",
        card_id: "card-456",
        merchant_name: "Netflix",
        amount: 999,
        frequency: "monthly" as const,
        status: "active",
        next_execution: new Date(Date.now() - 1000).toISOString(),
        execution_count: 12,
        max_executions: 12,
        auto_execute: true,
        notification_enabled: true,
        metadata: {},
      };

      mockSupabase.lte.mockResolvedValueOnce({
        data: [dueTransaction],
        error: null,
      });

      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result =
        await RecurringTransactionService.processDueRecurringTransactions();

      expect(result.processed).toBe(1);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed" })
      );
    });
  });

  describe("confirmPendingExecution", () => {
    it("should confirm pending execution and create transaction", async () => {
      const mockExecution = {
        id: "exec-123",
        recurring_transaction_id: "rec-123",
        status: "pending",
        amount_executed: 999,
        recurring_transactions: {
          user_id: "user-123",
          card_id: "card-456",
          merchant_name: "Netflix",
          category: "Entertainment",
          description: "Monthly subscription",
          execution_count: 5,
        },
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: mockExecution,
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "tx-789" },
        error: null,
      });

      await RecurringTransactionService.confirmPendingExecution(
        "exec-123",
        "user-123"
      );

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-123",
          amount: 999,
        })
      );
    });

    it("should throw error if execution not found", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: "Not found" },
      });

      await expect(
        RecurringTransactionService.confirmPendingExecution(
          "exec-123",
          "user-123"
        )
      ).rejects.toThrow();
    });

    it("should throw error if execution not pending", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: "exec-123",
          status: "completed",
          recurring_transactions: { user_id: "user-123" },
        },
        error: null,
      });

      await expect(
        RecurringTransactionService.confirmPendingExecution(
          "exec-123",
          "user-123"
        )
      ).rejects.toThrow("Execution is not pending");
    });
  });

  describe("skipPendingExecution", () => {
    it("should skip pending execution with reason", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: "exec-123",
          recurring_transactions: { user_id: "user-123" },
        },
        error: null,
      });

      await RecurringTransactionService.skipPendingExecution(
        "exec-123",
        "user-123",
        "Payment already made manually"
      );

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "skipped",
          error_message: "Payment already made manually",
        })
      );
    });
  });

  describe("getUpcomingRecurringTransactions", () => {
    it("should fetch upcoming transactions within specified days", async () => {
      const mockTransactions = [
        {
          id: "rec-1",
          merchant_name: "Netflix",
          next_execution: addDays(new Date(), 5).toISOString(),
        },
        {
          id: "rec-2",
          merchant_name: "Spotify",
          next_execution: addDays(new Date(), 10).toISOString(),
        },
      ];

      mockSupabase.order.mockResolvedValueOnce({
        data: mockTransactions,
        error: null,
      });

      const result =
        await RecurringTransactionService.getUpcomingRecurringTransactions(
          "user-123",
          30
        );

      expect(result).toHaveLength(2);
      expect(mockSupabase.lte).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle weekend skipping correctly", async () => {
      const saturdayDate = new Date("2025-11-08"); // Saturday
      const mockData = {
        user_id: "user-123",
        card_id: "card-456",
        merchant_name: "Test Merchant",
        amount: 100,
        frequency: "weekly" as const,
        start_date: saturdayDate.toISOString(),
        timezone: "Asia/Kolkata",
        notification_enabled: true,
        auto_execute: true,
        metadata: { skip_weekends: true },
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "rec-789", ...mockData, execution_count: 0 },
        error: null,
      });

      const result =
        await RecurringTransactionService.createRecurringTransaction(mockData);
      expect(result).toBeDefined();
    });

    it("should handle different frequencies correctly", async () => {
      const frequencies = [
        "daily",
        "weekly",
        "biweekly",
        "monthly",
        "quarterly",
        "annually",
      ];

      for (const frequency of frequencies) {
        const mockData = {
          user_id: "user-123",
          card_id: "card-456",
          merchant_name: `Test ${frequency}`,
          amount: 100,
          frequency: frequency as any,
          start_date: new Date().toISOString(),
          timezone: "Asia/Kolkata",
          notification_enabled: true,
          auto_execute: true,
        };

        mockSupabase.single.mockResolvedValueOnce({
          data: { id: `rec-${frequency}`, ...mockData, execution_count: 0 },
          error: null,
        });

        const result =
          await RecurringTransactionService.createRecurringTransaction(
            mockData
          );
        expect(result).toBeDefined();
      }
    });
  });
});
