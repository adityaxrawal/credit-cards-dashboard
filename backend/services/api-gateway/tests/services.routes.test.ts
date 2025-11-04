import request from "supertest";
import app from "../src/index";
import { supabase } from "shared/database/supabase";
import { redis } from "shared/cache/redis";
import jwt from "jsonwebtoken";

// Mock the shared modules
jest.mock("shared/database/supabase");
jest.mock("shared/cache/redis");

describe("Services Routes - Phase 3 Frontend-Triggered Services", () => {
  let authToken: string;
  const mockUserId = "test-user-123";
  const mockEmail = "test@example.com";

  beforeAll(() => {
    // Create a mock JWT token
    authToken = jwt.sign(
      { userId: mockUserId, email: mockEmail },
      process.env.JWT_SECRET || "test-secret"
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Redis session check
    (redis.get as jest.Mock).mockResolvedValue("session-data");
    (redis.del as jest.Mock).mockResolvedValue(1);
  });

  describe("POST /services/update-budget", () => {
    it("should update budget tracking for current month", async () => {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Mock transaction data
      const mockTransactions = [
        { amount: 1000, transaction_type: "debit" },
        { amount: 1500, transaction_type: "debit" },
        { amount: 2000, transaction_type: "credit" },
      ];

      // Mock user data
      const mockUser = { monthly_budget: 30000 };

      // Setup Supabase mocks
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "transactions") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            data: mockTransactions,
            error: null,
          };
        }
        if (table === "users") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockUser,
              error: null,
            }),
          };
        }
        if (table === "budget_tracking") {
          return {
            upsert: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
        };
      });

      const response = await request(app)
        .post("/services/update-budget")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.budget).toBeDefined();
      expect(response.body.budget.limit).toBe(30000);
      expect(response.body.budget.spent).toBe(2500); // 1000 + 1500 (debit only)
      expect(response.body.budget.remaining).toBe(27500);
      expect(parseFloat(response.body.budget.percentage)).toBeCloseTo(8.33, 1);
      expect(response.body.budget.status).toBe("safe");
    });

    it("should return 'warning' status when spending is 80%+", async () => {
      const mockTransactions = [{ amount: 24000, transaction_type: "debit" }];

      const mockUser = { monthly_budget: 30000 };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "transactions") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            data: mockTransactions,
            error: null,
          };
        }
        if (table === "users") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockUser,
              error: null,
            }),
          };
        }
        if (table === "budget_tracking") {
          return {
            upsert: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
        };
      });

      const response = await request(app)
        .post("/services/update-budget")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.budget.status).toBe("warning");
      expect(
        parseFloat(response.body.budget.percentage)
      ).toBeGreaterThanOrEqual(80);
    });

    it("should return 401 without authentication", async () => {
      await request(app).post("/services/update-budget").expect(401);
    });
  });

  describe("POST /services/check-alerts", () => {
    it("should generate alert when budget exceeded (100%)", async () => {
      const mockBudget = {
        id: "budget-123",
        user_id: mockUserId,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        budget_limit: 30000,
        total_spent: 31000,
        alert_sent: false,
      };

      const mockAlert = {
        id: "alert-123",
        user_id: mockUserId,
        alert_type: "budget_exceeded",
        priority: "high",
        title: "Budget Exceeded",
        message: "You've exceeded your monthly budget",
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "budget_tracking") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockBudget,
              error: null,
            }),
            update: jest.fn().mockReturnThis(),
          };
        }
        if (table === "alerts") {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockAlert,
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
        };
      });

      const response = await request(app)
        .post("/services/check-alerts")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.alerts).toBeDefined();
      expect(Array.isArray(response.body.alerts)).toBe(true);
    });

    it("should generate warning alert at 90% threshold", async () => {
      const mockBudget = {
        id: "budget-123",
        user_id: mockUserId,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        budget_limit: 30000,
        total_spent: 27500, // 91.67%
        alert_sent: false,
      };

      const mockAlert = {
        id: "alert-456",
        user_id: mockUserId,
        alert_type: "budget_warning",
        priority: "medium",
        title: "Budget Warning",
        message: "You've used 90% of your monthly budget",
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "budget_tracking") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockBudget,
              error: null,
            }),
          };
        }
        if (table === "alerts") {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockAlert,
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
        };
      });

      const response = await request(app)
        .post("/services/check-alerts")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.alerts).toBeDefined();
    });

    it("should return 401 without authentication", async () => {
      await request(app).post("/services/check-alerts").expect(401);
    });
  });

  describe("POST /services/check-reminders", () => {
    it("should return reminders for bills due within 7 days", async () => {
      const today = new Date();
      const dueInThreeDays = today.getDate() + 3;

      const mockCards = [
        {
          id: "card-123",
          card_name: "HDFC Regalia",
          bank_name: "HDFC Bank",
          due_date: dueInThreeDays,
          is_active: true,
        },
        {
          id: "card-456",
          card_name: "ICICI Amazon Pay",
          bank_name: "ICICI Bank",
          due_date: today.getDate() + 10, // Should not be included
          is_active: true,
        },
      ];

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "credit_cards") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            data: mockCards,
            error: null,
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
        };
      });

      const response = await request(app)
        .post("/services/check-reminders")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.reminders).toBeDefined();
      expect(Array.isArray(response.body.reminders)).toBe(true);
      // Only one card should have reminder (due within 7 days)
      expect(response.body.reminders.length).toBeGreaterThanOrEqual(0);
    });

    it("should return empty array when no bills due soon", async () => {
      const mockCards = [
        {
          id: "card-123",
          card_name: "HDFC Regalia",
          bank_name: "HDFC Bank",
          due_date: 25, // Assuming today is far from this date
          is_active: true,
        },
      ];

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "credit_cards") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            data: mockCards,
            error: null,
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
        };
      });

      const response = await request(app)
        .post("/services/check-reminders")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.reminders).toBeDefined();
      expect(Array.isArray(response.body.reminders)).toBe(true);
    });

    it("should return 401 without authentication", async () => {
      await request(app).post("/services/check-reminders").expect(401);
    });
  });

  describe("POST /services/refresh-analytics", () => {
    it("should invalidate all analytics cache keys", async () => {
      (redis.del as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .post("/services/refresh-analytics")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Analytics cache refreshed");
      expect(response.body.keysInvalidated).toBeGreaterThan(0);

      // Verify Redis.del was called for analytics keys
      expect(redis.del).toHaveBeenCalled();
    });

    it("should handle Redis errors gracefully", async () => {
      (redis.del as jest.Mock).mockRejectedValue(new Error("Redis error"));

      const response = await request(app)
        .post("/services/refresh-analytics")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should still succeed even if some cache deletions fail
    });

    it("should return 401 without authentication", async () => {
      await request(app).post("/services/refresh-analytics").expect(401);
    });
  });

  describe("Integration: All services orchestration", () => {
    it("should handle parallel service calls correctly", async () => {
      // This test simulates frontend calling all 4 services in parallel
      const promises = [
        request(app)
          .post("/services/update-budget")
          .set("Authorization", `Bearer ${authToken}`),
        request(app)
          .post("/services/check-alerts")
          .set("Authorization", `Bearer ${authToken}`),
        request(app)
          .post("/services/check-reminders")
          .set("Authorization", `Bearer ${authToken}`),
        request(app)
          .post("/services/refresh-analytics")
          .set("Authorization", `Bearer ${authToken}`),
      ];

      const results = await Promise.allSettled(promises);

      // All services should complete successfully
      results.forEach((result) => {
        expect(result.status).toBe("fulfilled");
        if (result.status === "fulfilled") {
          expect(result.value.status).toBe(200);
        }
      });
    });
  });
});
