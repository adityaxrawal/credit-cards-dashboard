import request from "supertest";
import express from "express";
import { AppError } from "../../../src/shared/errors/AppError";

// Mock transaction service
jest.mock("../../../src/modules/transactions/transactions.service", () => ({
  __esModule: true,
  default: {
    createTransaction: jest.fn(),
    getTransaction: jest.fn(),
    getUserTransactions: jest.fn(),
    updateTransaction: jest.fn(),
    deleteTransaction: jest.fn(),
    getTransactionStatistics: jest.fn(),
  },
}));

import transactionService from "../../../src/modules/transactions/transactions.service";

describe("Transactions API Integration Tests", () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock Express app
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    app.use((req: any, res, next) => {
      req.user = { id: "test-user-123" };
      next();
    });

    // Define transaction routes
    app.post("/api/transactions", async (req: any, res) => {
      try {
        const transaction = await transactionService.createTransaction(req.user.id, req.body);
        res.status(201).json({ success: true, data: transaction });
      } catch (error: any) {
        if (error instanceof AppError) {
          res.status(error.statusCode).json({
            success: false,
            error: { code: error.code, message: error.message },
          });
        } else {
          res.status(500).json({ success: false, error: { message: "Internal error" } });
        }
      }
    });

    app.get("/api/transactions", async (req: any, res) => {
      try {
        const transactions = await transactionService.getUserTransactions(req.user.id, req.query);
        res.json({ success: true, data: transactions });
      } catch (error: any) {
        res.status(500).json({ success: false, error: { message: error.message } });
      }
    });

    app.get("/api/transactions/:id", async (req: any, res) => {
      try {
        const transaction = await transactionService.getTransaction(req.params.id, req.user.id);
        res.json({ success: true, data: transaction });
      } catch (error: any) {
        if (error instanceof AppError) {
          res.status(error.statusCode).json({
            success: false,
            error: { code: error.code, message: error.message },
          });
        } else {
          res.status(500).json({ success: false, error: { message: error.message } });
        }
      }
    });

    app.put("/api/transactions/:id", async (req: any, res) => {
      try {
        const transaction = await transactionService.updateTransaction(
          req.params.id,
          req.user.id,
          req.body
        );
        res.json({ success: true, data: transaction });
      } catch (error: any) {
        if (error instanceof AppError) {
          res.status(error.statusCode).json({
            success: false,
            error: { code: error.code, message: error.message },
          });
        } else {
          res.status(500).json({ success: false, error: { message: error.message } });
        }
      }
    });

    app.delete("/api/transactions/:id", async (req: any, res) => {
      try {
        await transactionService.deleteTransaction(req.params.id, req.user.id);
        res.json({ success: true, message: "Transaction deleted" });
      } catch (error: any) {
        if (error instanceof AppError) {
          res.status(error.statusCode).json({
            success: false,
            error: { code: error.code, message: error.message },
          });
        } else {
          res.status(500).json({ success: false, error: { message: error.message } });
        }
      }
    });

    app.get("/api/transactions/stats/summary", async (req: any, res) => {
      try {
        const stats = await transactionService.getTransactionStatistics(req.user.id, req.query);
        res.json({ success: true, data: stats });
      } catch (error: any) {
        res.status(500).json({ success: false, error: { message: error.message } });
      }
    });
  });

  describe("POST /api/transactions", () => {
    it("should create a new transaction successfully", async () => {
      const mockTransaction = {
        id: "txn-123",
        user_id: "test-user-123",
        card_id: "card-456",
        amount: 1500,
        merchant_name: "Test Store",
        transaction_type: "debit",
        category: "Shopping",
        transaction_date: "2025-01-01",
        created_at: "2025-01-01T00:00:00Z",
      };

      (transactionService.createTransaction as jest.Mock).mockResolvedValue(mockTransaction);

      const response = await request(app)
        .post("/api/transactions")
        .send({
          card_id: "card-456",
          amount: 1500,
          merchant_name: "Test Store",
          transaction_type: "debit",
          category: "Shopping",
          transaction_date: "2025-01-01",
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.merchant_name).toBe("Test Store");
      expect(transactionService.createTransaction).toHaveBeenCalledWith(
        "test-user-123",
        expect.objectContaining({
          merchant_name: "Test Store",
          amount: 1500,
        })
      );
    });

    it("should return 400 for invalid transaction data", async () => {
      (transactionService.createTransaction as jest.Mock).mockRejectedValue(
        AppError.validation("Invalid transaction data")
      );

      const response = await request(app)
        .post("/api/transactions")
        .send({
          amount: -100, // Invalid negative amount
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 404 if card not found", async () => {
      (transactionService.createTransaction as jest.Mock).mockRejectedValue(
        AppError.notFound("Card not found")
      );

      const response = await request(app)
        .post("/api/transactions")
        .send({
          card_id: "invalid-card",
          amount: 1000,
          merchant_name: "Store",
          transaction_type: "debit",
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/transactions", () => {
    it("should fetch all transactions for user", async () => {
      const mockTransactions = [
        {
          id: "txn-1",
          merchant_name: "Store A",
          amount: 1000,
          transaction_date: "2025-01-01",
        },
        {
          id: "txn-2",
          merchant_name: "Store B",
          amount: 2000,
          transaction_date: "2025-01-02",
        },
      ];

      (transactionService.getUserTransactions as jest.Mock).mockResolvedValue(mockTransactions);

      const response = await request(app).get("/api/transactions").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].merchant_name).toBe("Store A");
    });

    it("should filter transactions by date range", async () => {
      const mockTransactions = [
        {
          id: "txn-1",
          merchant_name: "Store A",
          amount: 1000,
          transaction_date: "2025-01-15",
        },
      ];

      (transactionService.getUserTransactions as jest.Mock).mockResolvedValue(mockTransactions);

      const response = await request(app)
        .get("/api/transactions")
        .query({ startDate: "2025-01-01", endDate: "2025-01-31" })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(transactionService.getUserTransactions).toHaveBeenCalledWith(
        "test-user-123",
        expect.objectContaining({
          startDate: "2025-01-01",
          endDate: "2025-01-31",
        })
      );
    });

    it("should filter transactions by category", async () => {
      const mockTransactions = [
        {
          id: "txn-1",
          merchant_name: "Grocery Store",
          amount: 500,
          category: "Groceries",
        },
      ];

      (transactionService.getUserTransactions as jest.Mock).mockResolvedValue(mockTransactions);

      const response = await request(app)
        .get("/api/transactions")
        .query({ category: "Groceries" })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].category).toBe("Groceries");
    });
  });

  describe("GET /api/transactions/:id", () => {
    it("should fetch a single transaction by ID", async () => {
      const mockTransaction = {
        id: "txn-123",
        user_id: "test-user-123",
        merchant_name: "Test Store",
        amount: 1500,
        transaction_type: "debit",
      };

      (transactionService.getTransaction as jest.Mock).mockResolvedValue(mockTransaction);

      const response = await request(app).get("/api/transactions/txn-123").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe("txn-123");
      expect(response.body.data.merchant_name).toBe("Test Store");
    });

    it("should return 404 if transaction not found", async () => {
      (transactionService.getTransaction as jest.Mock).mockRejectedValue(
        AppError.notFound("Transaction not found")
      );

      const response = await request(app).get("/api/transactions/invalid-id").expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("PUT /api/transactions/:id", () => {
    it("should update a transaction successfully", async () => {
      const updatedTransaction = {
        id: "txn-123",
        merchant_name: "Updated Store",
        amount: 2000,
        category: "Updated Category",
      };

      (transactionService.updateTransaction as jest.Mock).mockResolvedValue(updatedTransaction);

      const response = await request(app)
        .put("/api/transactions/txn-123")
        .send({
          merchant_name: "Updated Store",
          amount: 2000,
          category: "Updated Category",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.merchant_name).toBe("Updated Store");
      expect(response.body.data.amount).toBe(2000);
    });

    it("should return 404 if transaction to update not found", async () => {
      (transactionService.updateTransaction as jest.Mock).mockRejectedValue(
        AppError.notFound("Transaction not found")
      );

      const response = await request(app)
        .put("/api/transactions/invalid-id")
        .send({ amount: 2000 })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe("DELETE /api/transactions/:id", () => {
    it("should delete a transaction successfully", async () => {
      (transactionService.deleteTransaction as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app).delete("/api/transactions/txn-123").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Transaction deleted");
      expect(transactionService.deleteTransaction).toHaveBeenCalledWith("txn-123", "test-user-123");
    });

    it("should return 404 if transaction to delete not found", async () => {
      (transactionService.deleteTransaction as jest.Mock).mockRejectedValue(
        AppError.notFound("Transaction not found")
      );

      const response = await request(app).delete("/api/transactions/invalid-id").expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/transactions/stats/summary", () => {
    it("should fetch transaction statistics", async () => {
      const mockStats = {
        total_spent: 50000,
        total_earned: 5000,
        transaction_count: 25,
        avg_transaction_value: 2000,
        by_category: {
          Groceries: 15000,
          Entertainment: 10000,
          Shopping: 25000,
        },
        by_month: {
          "2025-01": 50000,
        },
      };

      (transactionService.getTransactionStatistics as jest.Mock).mockResolvedValue(mockStats);

      const response = await request(app)
        .get("/api/transactions/stats/summary")
        .query({ startDate: "2025-01-01", endDate: "2025-01-31" })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total_spent).toBe(50000);
      expect(response.body.data.transaction_count).toBe(25);
    });
  });

  describe("Error Handling", () => {
    it("should handle validation errors", async () => {
      (transactionService.createTransaction as jest.Mock).mockRejectedValue(
        AppError.validation("Amount must be positive")
      );

      const response = await request(app)
        .post("/api/transactions")
        .send({ amount: -500 })
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should handle unauthorized access", async () => {
      (transactionService.getTransaction as jest.Mock).mockRejectedValue(
        AppError.unauthorized("Unauthorized")
      );

      const response = await request(app).get("/api/transactions/txn-123").expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
