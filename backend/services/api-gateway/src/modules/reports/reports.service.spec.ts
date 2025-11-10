import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { ReportsService } from "../reports.service";
import { supabase } from "shared/database/supabase";

// Mock Supabase
jest.mock("shared/database/supabase");
jest.mock("shared/monitoring/logger");

describe("ReportsService", () => {
  let reportsService: ReportsService;
  const mockUserId = "user-123";
  const mockReportId = "report-456";

  beforeEach(() => {
    reportsService = new ReportsService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Budget Performance Analysis", () => {
    it("should calculate budget performance correctly", async () => {
      const mockBudgets = [
        {
          id: "budget-1",
          category: "Food",
          limit: 1000,
          period: "monthly",
        },
      ];

      const mockTransactions = [
        {
          id: "txn-1",
          merchant_category: "Food",
          amount: 750,
          transaction_type: "debit",
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        then: jest
          .fn()
          .mockResolvedValueOnce({ data: mockBudgets, error: null })
          .mockResolvedValueOnce({ data: mockTransactions, error: null }),
      });

      const config = {
        type: "budget_performance" as const,
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-01-31"),
      };

      const result = await reportsService["generateBudgetPerformance"](mockUserId, config);

      expect(result).toBeDefined();
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].category).toBe("Food");
      expect(result.categories[0].spent).toBe(750);
      expect(result.categories[0].percentageUsed).toBe(75);
      expect(result.categories[0].status).toBe("on_track");
    });

    it("should handle over-budget scenarios", async () => {
      const mockBudgets = [
        {
          id: "budget-1",
          category: "Entertainment",
          limit: 500,
        },
      ];

      const mockTransactions = [
        {
          merchant_category: "Entertainment",
          amount: 600,
          transaction_type: "debit",
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        then: jest
          .fn()
          .mockResolvedValueOnce({ data: mockBudgets, error: null })
          .mockResolvedValueOnce({ data: mockTransactions, error: null }),
      });

      const config = {
        type: "budget_performance" as const,
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-01-31"),
      };

      const result = await reportsService["generateBudgetPerformance"](mockUserId, config);

      expect(result.categories[0].status).toBe("over_budget");
      expect(result.categories[0].percentageUsed).toBe(120);
    });
  });

  describe("Monthly Trends Analysis", () => {
    it("should calculate monthly trends correctly", async () => {
      const mockTransactions = [
        {
          transaction_date: "2025-01-15",
          amount: 1000,
          transaction_type: "debit",
        },
        {
          transaction_date: "2025-02-20",
          amount: 1200,
          transaction_type: "debit",
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null }),
      });

      const config = {
        type: "monthly_trends" as const,
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-02-28"),
      };

      const result = await reportsService["generateMonthlyTrends"](mockUserId, config);

      expect(result).toBeDefined();
      expect(result.months).toBeDefined();
      expect(result.trend).toBeDefined();
      expect(result.growthRate).toBeDefined();
    });
  });

  describe("Cashflow Analysis", () => {
    it("should calculate cashflow correctly", async () => {
      const mockTransactions = [
        {
          transaction_date: "2025-01-15",
          amount: 500,
          transaction_type: "credit",
        },
        {
          transaction_date: "2025-01-20",
          amount: 300,
          transaction_type: "debit",
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null }),
      });

      const config = {
        type: "cashflow_analysis" as const,
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-01-31"),
      };

      const result = await reportsService["generateCashflowAnalysis"](mockUserId, config);

      expect(result).toBeDefined();
      expect(result.totalInflow).toBe(500);
      expect(result.totalOutflow).toBe(300);
      expect(result.netCashflow).toBe(200);
    });
  });

  describe("Merchant Analysis", () => {
    it("should analyze merchant spending correctly", async () => {
      const mockTransactions = [
        {
          merchant_name: "Amazon",
          merchant_category: "Shopping",
          amount: 200,
          transaction_type: "debit",
        },
        {
          merchant_name: "Amazon",
          merchant_category: "Shopping",
          amount: 300,
          transaction_type: "debit",
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null }),
      });

      const config = {
        type: "merchant_analysis" as const,
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-01-31"),
      };

      const result = await reportsService["generateMerchantAnalysis"](mockUserId, config);

      expect(result).toBeDefined();
      expect(result.topMerchants).toBeDefined();
      expect(result.topMerchants[0].merchant).toBe("Amazon");
      expect(result.topMerchants[0].totalSpent).toBe(500);
    });
  });

  describe("PDF Generation", () => {
    it("should generate PDF content", async () => {
      const mockData = {
        totalSpending: 1000,
        categories: [{ name: "Food", amount: 500 }],
      };

      const result = await reportsService["generatePDFContent"](mockData, "spending_summary");

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result).toContain("<!DOCTYPE html>");
      expect(result).toContain("totalSpending");
    });
  });

  describe("CSV Export", () => {
    it("should generate CSV content correctly", async () => {
      const mockData = {
        transactions: [
          { date: "2025-01-01", merchant: "Store", amount: 50 },
          { date: "2025-01-02", merchant: "Restaurant", amount: 30 },
        ],
      };

      const result = await reportsService["generateCSVContent"](mockData, "spending_summary");

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result).toContain("date,merchant,amount");
      expect(result.split("\n").length).toBeGreaterThan(1);
    });
  });

  describe("Error Handling", () => {
    it("should throw AppError on database failure", async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error" },
        }),
      });

      await expect(reportsService.getReports(mockUserId)).rejects.toThrow();
    });
  });
});
