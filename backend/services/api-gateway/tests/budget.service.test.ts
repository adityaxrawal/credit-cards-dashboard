import { BudgetService } from "../src/services/budget.service";
import { supabase } from "shared/database/supabase";

jest.mock("shared/database/supabase");

describe("BudgetService", () => {
  const mockUserId = "test-user-123";
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("calculateBudget", () => {
    it("should calculate correct budget with debit transactions", async () => {
      const mockTransactions = [
        { amount: 1000, transaction_type: "debit" },
        { amount: 1500, transaction_type: "debit" },
        { amount: 500, transaction_type: "credit" }, // Should not be included
      ];

      const mockUser = { monthly_budget: 10000 };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "transactions") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            data: mockTransactions,
          };
        }
        if (table === "users") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockUser }),
          };
        }
      });

      const result = await BudgetService.calculateBudget(mockUserId);

      expect(result.totalSpent).toBe(2500);
      expect(result.budgetLimit).toBe(10000);
      expect(result.remaining).toBe(7500);
      expect(result.percentage).toBe(25);
    });

    it("should handle empty transactions", async () => {
      const mockUser = { monthly_budget: 10000 };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "transactions") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            data: [],
          };
        }
        if (table === "users") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockUser }),
          };
        }
      });

      const result = await BudgetService.calculateBudget(mockUserId);

      expect(result.totalSpent).toBe(0);
      expect(result.remaining).toBe(10000);
      expect(result.percentage).toBe(0);
      expect(result.status).toBe("safe");
    });

    it("should return correct status for different budget percentages", async () => {
      const testCases = [
        { spent: 7000, limit: 10000, expectedStatus: "safe" },
        { spent: 8500, limit: 10000, expectedStatus: "warning" },
        { spent: 9200, limit: 10000, expectedStatus: "critical" },
        { spent: 11000, limit: 10000, expectedStatus: "exceeded" },
      ];

      for (const testCase of testCases) {
        const mockTransactions = [
          { amount: testCase.spent, transaction_type: "debit" },
        ];
        const mockUser = { monthly_budget: testCase.limit };

        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === "transactions") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              data: mockTransactions,
            };
          }
          if (table === "users") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: mockUser }),
            };
          }
        });

        const result = await BudgetService.calculateBudget(mockUserId);
        expect(result.status).toBe(testCase.expectedStatus);
      }
    });

    it("should use default budget if user has no monthly_budget set", async () => {
      const mockTransactions = [{ amount: 5000, transaction_type: "debit" }];
      const mockUser = { monthly_budget: null };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "transactions") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            data: mockTransactions,
          };
        }
        if (table === "users") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockUser }),
          };
        }
      });

      const result = await BudgetService.calculateBudget(mockUserId);

      expect(result.budgetLimit).toBe(30000); // Default budget
      expect(result.totalSpent).toBe(5000);
    });

    it("should handle database errors gracefully", async () => {
      (supabase.from as jest.Mock).mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      await expect(BudgetService.calculateBudget(mockUserId)).rejects.toThrow(
        "Database connection failed"
      );
    });
  });

  describe("updateBudgetTracking", () => {
    it("should upsert budget tracking record", async () => {
      const mockUpsert = jest.fn().mockResolvedValue({ data: {}, error: null });

      (supabase.from as jest.Mock).mockReturnValue({
        upsert: mockUpsert,
      });

      await BudgetService.updateBudgetTracking({
        user_id: mockUserId,
        month: currentMonth,
        year: currentYear,
        budget_limit: 10000,
        total_spent: 5000,
      });

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          month: currentMonth,
          year: currentYear,
          budget_limit: 10000,
          total_spent: 5000,
        }),
        expect.any(Object)
      );
    });

    it("should handle upsert conflicts correctly", async () => {
      const mockUpsert = jest.fn().mockResolvedValue({
        data: { id: "existing-record" },
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        upsert: mockUpsert,
      });

      await BudgetService.updateBudgetTracking({
        user_id: mockUserId,
        month: currentMonth,
        year: currentYear,
        budget_limit: 10000,
        total_spent: 8000,
      });

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          onConflict: "user_id,month,year",
        })
      );
    });
  });

  describe("getBudgetStatus", () => {
    it("should return budget status for current month", async () => {
      const mockBudget = {
        id: "budget-1",
        user_id: mockUserId,
        month: currentMonth,
        year: currentYear,
        budget_limit: 10000,
        total_spent: 7500,
        alert_sent: false,
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockBudget }),
      });

      const result = await BudgetService.getBudgetStatus(mockUserId);

      expect(result).toEqual(mockBudget);
    });

    it("should return null if no budget record exists", async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null }),
      });

      const result = await BudgetService.getBudgetStatus(mockUserId);

      expect(result).toBeNull();
    });
  });

  describe("edge cases and validation", () => {
    it("should handle negative amounts correctly", async () => {
      const mockTransactions = [
        { amount: -100, transaction_type: "debit" }, // Should be treated as 0 or error
        { amount: 500, transaction_type: "debit" },
      ];

      const mockUser = { monthly_budget: 10000 };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "transactions") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            data: mockTransactions,
          };
        }
        if (table === "users") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockUser }),
          };
        }
      });

      const result = await BudgetService.calculateBudget(mockUserId);

      // Should handle negative amounts appropriately
      expect(result.totalSpent).toBeGreaterThanOrEqual(0);
    });

    it("should handle very large transaction amounts", async () => {
      const mockTransactions = [
        { amount: 999999999, transaction_type: "debit" },
      ];

      const mockUser = { monthly_budget: 10000 };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "transactions") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            data: mockTransactions,
          };
        }
        if (table === "users") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockUser }),
          };
        }
      });

      const result = await BudgetService.calculateBudget(mockUserId);

      expect(result.totalSpent).toBe(999999999);
      expect(result.status).toBe("exceeded");
    });

    it("should correctly filter by billing cycle", async () => {
      const mockTransactions = [
        {
          amount: 1000,
          transaction_type: "debit",
          billing_cycle_month: currentMonth,
          billing_cycle_year: currentYear,
        },
        {
          amount: 2000,
          transaction_type: "debit",
          billing_cycle_month: currentMonth - 1, // Previous month
          billing_cycle_year: currentYear,
        },
      ];

      const mockUser = { monthly_budget: 10000 };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "transactions") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockImplementation((field: string, value: any) => {
              if (field === "billing_cycle_month" && value === currentMonth) {
                return {
                  eq: jest.fn().mockReturnThis(),
                  data: [mockTransactions[0]],
                };
              }
              return { eq: jest.fn().mockReturnThis(), data: mockTransactions };
            }),
          };
        }
        if (table === "users") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockUser }),
          };
        }
      });

      const result = await BudgetService.calculateBudget(mockUserId);

      // Should only count current month's transaction
      expect(result.totalSpent).toBeLessThanOrEqual(1000);
    });
  });
});
