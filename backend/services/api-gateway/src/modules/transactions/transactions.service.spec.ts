import { TransactionService } from "./transactions.service";
import { AppError } from "../../../shared/errors/AppError";

// Mock Supabase
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn(),
  range: jest.fn().mockReturnThis(),
};

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => mockSupabase),
}));

describe("TransactionService", () => {
  let service: TransactionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TransactionService();
  });

  describe("createTransaction", () => {
    const validTransaction = {
      card_id: "card-123",
      transaction_date: "2025-01-15",
      amount: 1500,
      transaction_type: "debit" as const,
      merchant_name: "Test Store",
      category: "Shopping",
    };

    it("should create a transaction successfully", async () => {
      const mockCard = {
        id: "card-123",
        user_id: "user-123",
        bill_date: 1,
      };

      const mockCreatedTransaction = {
        id: "txn-1",
        ...validTransaction,
        billing_month: 2,
        billing_year: 2025,
      };

      // Mock card fetch
      mockSupabase.single.mockResolvedValueOnce({
        data: mockCard,
        error: null,
      });

      // Mock transaction insert
      mockSupabase.single.mockResolvedValueOnce({
        data: mockCreatedTransaction,
        error: null,
      });

      const result = await service.createTransaction("user-123", validTransaction);

      expect(result).toEqual(mockCreatedTransaction);
      expect(mockSupabase.from).toHaveBeenCalledWith("credit_cards");
      expect(mockSupabase.from).toHaveBeenCalledWith("transactions");
    });

    it("should throw validation error for missing card_id", async () => {
      const invalidData = { ...validTransaction, card_id: "" };

      await expect(service.createTransaction("user-123", invalidData)).rejects.toThrow(AppError);
    });

    it("should throw validation error for invalid amount", async () => {
      const invalidData = { ...validTransaction, amount: -100 };

      await expect(service.createTransaction("user-123", invalidData)).rejects.toThrow(AppError);
    });

    it("should throw validation error for invalid transaction type", async () => {
      const invalidData = { ...validTransaction, transaction_type: "invalid" as any };

      await expect(service.createTransaction("user-123", invalidData)).rejects.toThrow(AppError);
    });

    it("should throw error if card not found", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: "Card not found" },
      });

      await expect(service.createTransaction("user-123", validTransaction)).rejects.toThrow(
        AppError
      );
    });
  });

  describe("getTransaction", () => {
    it("should fetch transaction by ID", async () => {
      const mockTransaction = {
        id: "txn-1",
        card_id: "card-123",
        amount: 1500,
        merchant_name: "Test Store",
      };

      mockSupabase.single.mockResolvedValue({
        data: mockTransaction,
        error: null,
      });

      const result = await service.getTransactionById("txn-1", "user-123");

      expect(result).toEqual(mockTransaction);
      expect(mockSupabase.eq).toHaveBeenCalledWith("id", "txn-1");
    });

    it("should throw AppError.notFound when transaction not found", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(service.getTransactionById("invalid-id", "user-123")).rejects.toThrow(AppError);
    });
  });

  describe("getTransactions", () => {
    it("should fetch all transactions for user", async () => {
      const mockTransactions = [
        {
          id: "txn-1",
          amount: 1000,
          merchant_name: "Store 1",
          transaction_date: "2025-01-15",
        },
        {
          id: "txn-2",
          amount: 2000,
          merchant_name: "Store 2",
          transaction_date: "2025-01-16",
        },
      ];

      mockSupabase.range.mockResolvedValue({
        data: mockTransactions,
        error: null,
        count: 2,
      });

      const result = await service.getTransactions("user-123", {});

      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("should filter transactions by date range", async () => {
      const mockTransactions = [{ id: "txn-1", transaction_date: "2025-01-15" }];

      mockSupabase.range.mockResolvedValue({
        data: mockTransactions,
        error: null,
        count: 1,
      });

      await service.getTransactions("user-123", {
        startDate: "2025-01-01",
        endDate: "2025-01-31",
      });

      expect(mockSupabase.gte).toHaveBeenCalledWith("transaction_date", "2025-01-01");
      expect(mockSupabase.lte).toHaveBeenCalledWith("transaction_date", "2025-01-31");
    });

    it("should filter transactions by card", async () => {
      const mockTransactions = [{ id: "txn-1", card_id: "card-123" }];

      mockSupabase.range.mockResolvedValue({
        data: mockTransactions,
        error: null,
        count: 1,
      });

      await service.getTransactions("user-123", { cardId: "card-123" });

      expect(mockSupabase.eq).toHaveBeenCalledWith("card_id", "card-123");
    });
  });

  describe("updateTransaction", () => {
    it("should update transaction successfully", async () => {
      const updateData = {
        amount: 2000,
        merchant_name: "Updated Store",
      };

      const mockExisting = {
        id: "txn-1",
        card_id: "card-123",
        user_id: "user-123",
      };

      const mockCard = {
        id: "card-123",
        bill_date: 1,
      };

      const mockUpdated = {
        id: "txn-1",
        ...updateData,
      };

      // Mock existing transaction check
      mockSupabase.single.mockResolvedValueOnce({
        data: mockExisting,
        error: null,
      });

      // Mock card fetch (for billing cycle)
      mockSupabase.single.mockResolvedValueOnce({
        data: mockCard,
        error: null,
      });

      // Mock update
      mockSupabase.single.mockResolvedValueOnce({
        data: mockUpdated,
        error: null,
      });

      const result = await service.updateTransaction("txn-1", "user-123", updateData);

      expect(result).toEqual(mockUpdated);
      expect(mockSupabase.update).toHaveBeenCalled();
    });

    it("should validate amount on update", async () => {
      const invalidData = { amount: -500 };

      await expect(service.updateTransaction("txn-1", "user-123", invalidData)).rejects.toThrow(
        AppError
      );
    });
  });

  describe("deleteTransaction", () => {
    it("should soft delete transaction", async () => {
      const mockTransaction = {
        id: "txn-1",
        user_id: "user-123",
        is_deleted: false,
      };

      // Mock getTransactionById
      mockSupabase.single.mockResolvedValueOnce({
        data: mockTransaction,
        error: null,
      });

      // Mock update
      mockSupabase.single.mockResolvedValueOnce({
        data: { ...mockTransaction, is_deleted: true },
        error: null,
      });

      await service.deleteTransaction("txn-1", "user-123");

      expect(mockSupabase.update).toHaveBeenCalledWith({ is_deleted: true });
    });
  });

  describe("getTransactionStats", () => {
    it("should calculate transaction statistics", async () => {
      const mockTransactions = [
        { transaction_type: "debit", amount: 1000 },
        { transaction_type: "debit", amount: 2000 },
        { transaction_type: "credit", amount: 500 },
        { transaction_type: "refund", amount: 200 },
      ];

      mockSupabase.select.mockResolvedValue({
        data: mockTransactions,
        error: null,
      });

      const stats = await service.getTransactionStats("user-123", "card-123", {
        startDate: "2025-01-01",
        endDate: "2025-01-31",
      });

      expect(stats.totalDebits).toBe(3000);
      expect(stats.totalCredits).toBe(500);
      expect(stats.totalRefunds).toBe(200);
      expect(stats.categoryBreakdown).toBeDefined();
    });
  });
});
