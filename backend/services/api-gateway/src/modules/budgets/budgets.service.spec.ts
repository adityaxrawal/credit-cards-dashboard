import { EnhancedBudgetService, BudgetCategory, CardBudget, PeriodType } from "./budgets.service";
import { supabase } from "shared/database/supabase";
import { AppError } from "shared/errors/AppError";

// Mock Supabase
jest.mock("shared/database/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Mock logger
jest.mock("shared/monitoring/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("EnhancedBudgetService", () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      single: jest.fn(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn(),
    };

    (supabase.from as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe("createCategoryBudget", () => {
    it("should create a monthly category budget successfully", async () => {
      const mockBudget: BudgetCategory = {
        id: "budget-123",
        user_id: "user-123",
        category_name: "Groceries",
        budget_limit: 15000,
        period_type: "monthly",
        start_date: "2025-01-01",
        end_date: "2025-01-31",
        is_active: true,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      };

      mockSupabase.single.mockResolvedValue({ data: mockBudget, error: null });

      const result = await EnhancedBudgetService.createCategoryBudget(
        "user-123",
        "Groceries",
        15000,
        "monthly"
      );

      expect(result).toEqual(mockBudget);
      expect(supabase.from).toHaveBeenCalledWith("budget_categories");
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it("should create a quarterly category budget with correct end date", async () => {
      const mockBudget: BudgetCategory = {
        id: "budget-456",
        user_id: "user-123",
        category_name: "Entertainment",
        budget_limit: 30000,
        period_type: "quarterly",
        start_date: "2025-01-01",
        end_date: "2025-04-01",
        is_active: true,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      };

      mockSupabase.single.mockResolvedValue({ data: mockBudget, error: null });

      const result = await EnhancedBudgetService.createCategoryBudget(
        "user-123",
        "Entertainment",
        30000,
        "quarterly",
        new Date("2025-01-01")
      );

      expect(result).toEqual(mockBudget);
    });

    it("should throw AppError when database operation fails", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      await expect(
        EnhancedBudgetService.createCategoryBudget("user-123", "Food", 10000)
      ).rejects.toThrow(AppError);
    });
  });

  describe("updateCategoryBudget", () => {
    it("should update category budget successfully", async () => {
      const oldBudget = {
        id: "budget-123",
        user_id: "user-123",
        category_name: "Groceries",
        budget_limit: 15000,
      };

      const updatedBudget = {
        ...oldBudget,
        budget_limit: 20000,
        updated_at: new Date().toISOString(),
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: oldBudget, error: null })
        .mockResolvedValueOnce({ data: updatedBudget, error: null });

      const result = await EnhancedBudgetService.updateCategoryBudget("user-123", "budget-123", {
        budget_limit: 20000,
      });

      expect(result.budget_limit).toBe(20000);
      expect(mockSupabase.update).toHaveBeenCalled();
    });

    it("should throw AppError when update fails", async () => {
      mockSupabase.single
        .mockResolvedValueOnce({ data: {}, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: "Update failed" } });

      await expect(
        EnhancedBudgetService.updateCategoryBudget("user-123", "budget-123", {
          budget_limit: 20000,
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe("getCategoryBudgets", () => {
    it("should fetch all active category budgets", async () => {
      const mockBudgets: BudgetCategory[] = [
        {
          id: "budget-1",
          user_id: "user-123",
          category_name: "Groceries",
          budget_limit: 15000,
          period_type: "monthly",
          start_date: "2025-01-01",
          is_active: true,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
        {
          id: "budget-2",
          user_id: "user-123",
          category_name: "Entertainment",
          budget_limit: 10000,
          period_type: "monthly",
          start_date: "2025-01-01",
          is_active: true,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            eq: jest.fn().mockResolvedValueOnce({ data: mockBudgets, error: null }),
          }),
        }),
      });

      const result = await EnhancedBudgetService.getCategoryBudgets("user-123");

      expect(result).toHaveLength(2);
      expect(result[0].category_name).toBe("Groceries");
    });

    it("should filter budgets by period type", async () => {
      const mockBudgets: BudgetCategory[] = [
        {
          id: "budget-1",
          user_id: "user-123",
          category_name: "Groceries",
          budget_limit: 15000,
          period_type: "quarterly",
          start_date: "2025-01-01",
          is_active: true,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            eq: jest.fn().mockReturnValueOnce({
              eq: jest.fn().mockResolvedValueOnce({ data: mockBudgets, error: null }),
            }),
          }),
        }),
      });

      const result = await EnhancedBudgetService.getCategoryBudgets("user-123", "quarterly");

      expect(result).toHaveLength(1);
      expect(result[0].period_type).toBe("quarterly");
    });
  });

  describe("setCardBudget", () => {
    it("should create a new card budget", async () => {
      const mockCardBudget: CardBudget = {
        id: "card-budget-123",
        user_id: "user-123",
        card_id: "card-456",
        month: 1,
        year: 2025,
        budget_limit: 50000,
        total_spent: 0,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      };

      mockSupabase.single.mockResolvedValue({ data: mockCardBudget, error: null });

      const result = await EnhancedBudgetService.setCardBudget(
        "user-123",
        "card-456",
        1,
        2025,
        50000
      );

      expect(result).toEqual(mockCardBudget);
      expect(supabase.from).toHaveBeenCalledWith("card_budgets");
    });

    it("should throw AppError when card budget creation fails", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: "Creation failed" },
      });

      await expect(
        EnhancedBudgetService.setCardBudget("user-123", "card-456", 1, 2025, 50000)
      ).rejects.toThrow(AppError);
    });
  });

  describe("getCardBudgets", () => {
    it("should fetch all card budgets for a user", async () => {
      const mockCardBudgets: CardBudget[] = [
        {
          id: "card-budget-1",
          user_id: "user-123",
          card_id: "card-1",
          month: 1,
          year: 2025,
          budget_limit: 50000,
          total_spent: 25000,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-15T00:00:00Z",
        },
        {
          id: "card-budget-2",
          user_id: "user-123",
          card_id: "card-2",
          month: 1,
          year: 2025,
          budget_limit: 30000,
          total_spent: 15000,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-15T00:00:00Z",
        },
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockResolvedValueOnce({ data: mockCardBudgets, error: null }),
        }),
      });

      const result = await EnhancedBudgetService.getCardBudgets("user-123");

      expect(result).toHaveLength(2);
      expect(result[0].budget_limit).toBe(50000);
    });
  });

  describe("getBudgetAlertConfig", () => {
    it("should retrieve budget alert configuration", async () => {
      const mockConfig = {
        id: "config-123",
        user_id: "user-123",
        threshold_percentages: [50, 75, 90],
        alert_channels: ["email", "push"],
        daily_digest_enabled: true,
        weekly_summary_enabled: true,
        custom_rules: [],
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      };

      mockSupabase.single.mockResolvedValue({ data: mockConfig, error: null });

      const result = await EnhancedBudgetService.getBudgetAlertConfig("user-123");

      expect(result).toEqual(mockConfig);
      expect(result.threshold_percentages).toContain(75);
    });

    it("should create default config if none exists", async () => {
      const defaultConfig = {
        id: "config-new",
        user_id: "user-123",
        threshold_percentages: [75, 90],
        alert_channels: ["email"],
        daily_digest_enabled: false,
        weekly_summary_enabled: false,
        custom_rules: [],
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } })
        .mockResolvedValueOnce({ data: defaultConfig, error: null });

      const result = await EnhancedBudgetService.getBudgetAlertConfig("user-123");

      expect(result).toEqual(defaultConfig);
    });
  });

  describe("updateBudgetAlertConfig", () => {
    it("should update alert configuration successfully", async () => {
      const updatedConfig = {
        id: "config-123",
        user_id: "user-123",
        threshold_percentages: [50, 80, 95],
        alert_channels: ["email", "sms", "push"],
        daily_digest_enabled: true,
        weekly_summary_enabled: true,
        custom_rules: [],
        created_at: "2025-01-01T00:00:00Z",
        updated_at: new Date().toISOString(),
      };

      mockSupabase.single.mockResolvedValue({ data: updatedConfig, error: null });

      const result = await EnhancedBudgetService.updateBudgetAlertConfig("user-123", {
        threshold_percentages: [50, 80, 95],
        alert_channels: ["email", "sms", "push"],
      });

      expect(result.threshold_percentages).toContain(95);
      expect(result.alert_channels).toHaveLength(3);
    });
  });

  describe("getBudgetAuditLog", () => {
    it("should fetch audit logs with default limit", async () => {
      const mockLogs = [
        {
          id: "log-1",
          user_id: "user-123",
          budget_id: "budget-123",
          action_type: "create",
          entity_type: "budget_category",
          created_at: "2025-01-01T00:00:00Z",
        },
        {
          id: "log-2",
          user_id: "user-123",
          budget_id: "budget-123",
          action_type: "update",
          entity_type: "budget_category",
          created_at: "2025-01-02T00:00:00Z",
        },
      ];

      mockSupabase.limit.mockResolvedValue({ data: mockLogs, error: null });

      const result = await EnhancedBudgetService.getBudgetAuditLog("user-123");

      expect(result).toHaveLength(2);
      expect(result[0].action_type).toBe("create");
    });

    it("should filter audit logs by date range", async () => {
      const mockLogs = [
        {
          id: "log-1",
          user_id: "user-123",
          action_type: "create",
          created_at: "2025-01-15T00:00:00Z",
        },
      ];

      mockSupabase.limit.mockResolvedValue({ data: mockLogs, error: null });

      const result = await EnhancedBudgetService.getBudgetAuditLog(
        "user-123",
        undefined,
        new Date("2025-01-01"),
        new Date("2025-01-31")
      );

      expect(result).toHaveLength(1);
      expect(mockSupabase.gte).toHaveBeenCalled();
      expect(mockSupabase.lte).toHaveBeenCalled();
    });
  });

  describe("getComprehensiveBudgetAnalytics", () => {
    it("should return comprehensive budget analytics", async () => {
      const mockAnalytics = {
        summary: {
          total_budgets: 5,
          active_budgets: 4,
          total_budget_amount: 100000,
          total_spent: 65000,
          overall_utilization: 65,
        },
        category_breakdown: [],
        card_breakdown: [],
        alerts_triggered: [],
        spending_trends: [],
      };

      // Mock multiple Supabase calls
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await EnhancedBudgetService.getComprehensiveBudgetAnalytics("user-123");

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(supabase.from).toHaveBeenCalled();
    });
  });
});
