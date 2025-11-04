import { AlertService } from "../src/services/alert.service";
import { supabase } from "shared/database/supabase";

jest.mock("shared/database/supabase");

describe("AlertService", () => {
  const mockUserId = "test-user-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new alert", async () => {
      const mockAlert = {
        id: "alert-1",
        user_id: mockUserId,
        alert_type: "budget_warning",
        priority: "medium",
        title: "Budget Warning",
        message: "You've used 85% of your monthly budget",
        is_read: false,
        created_at: new Date().toISOString(),
      };

      const mockInsert = jest.fn().mockResolvedValue({
        data: mockAlert,
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockAlert }),
      });

      const result = await AlertService.create({
        user_id: mockUserId,
        alert_type: "budget_warning",
        priority: "medium",
        title: "Budget Warning",
        message: "You've used 85% of your monthly budget",
        metadata: { percentage: 85 },
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          alert_type: "budget_warning",
          priority: "medium",
          title: "Budget Warning",
        })
      );
      expect(result).toEqual(mockAlert);
    });

    it("should handle database errors during creation", async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error" },
        }),
      });

      await expect(
        AlertService.create({
          user_id: mockUserId,
          alert_type: "budget_exceeded",
          priority: "high",
          title: "Budget Exceeded",
          message: "Budget exceeded",
        })
      ).rejects.toThrow();
    });

    it("should create alerts with different priority levels", async () => {
      const priorities = ["low", "medium", "high", "critical"];

      for (const priority of priorities) {
        const mockInsert = jest.fn().mockResolvedValue({
          data: { priority },
          error: null,
        });

        (supabase.from as jest.Mock).mockReturnValue({
          insert: mockInsert,
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { priority } }),
        });

        const result = await AlertService.create({
          user_id: mockUserId,
          alert_type: "test",
          priority: priority as "low" | "medium" | "high" | "critical",
          title: "Test Alert",
          message: "Test message",
        });

        expect(result.priority).toBe(priority);
      }
    });
  });

  describe("checkBudgetAlerts", () => {
    it("should generate alert when budget exceeds 80%", async () => {
      const mockBudget = {
        user_id: mockUserId,
        month: 11,
        year: 2025,
        budget_limit: 10000,
        total_spent: 8500,
        alert_sent: false,
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "budget_tracking") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockBudget }),
          };
        }
        if (table === "alerts") {
          return {
            insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                alert_type: "budget_warning",
                message: "You've used 85% of your monthly budget",
              },
            }),
          };
        }
      });

      const alerts = await AlertService.checkBudgetAlerts(mockUserId);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].alert_type).toBe("budget_warning");
    });

    it("should generate high-priority alert when budget exceeds 100%", async () => {
      const mockBudget = {
        user_id: mockUserId,
        month: 11,
        year: 2025,
        budget_limit: 10000,
        total_spent: 11000,
        alert_sent: false,
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "budget_tracking") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockBudget }),
          };
        }
        if (table === "alerts") {
          return {
            insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                alert_type: "budget_exceeded",
                priority: "high",
              },
            }),
          };
        }
        if (table === "budget_tracking" && mockBudget) {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: {}, error: null }),
          };
        }
      });

      const alerts = await AlertService.checkBudgetAlerts(mockUserId);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].alert_type).toBe("budget_exceeded");
      expect(alerts[0].priority).toBe("high");
    });

    it("should not generate duplicate alerts if already sent", async () => {
      const mockBudget = {
        user_id: mockUserId,
        month: 11,
        year: 2025,
        budget_limit: 10000,
        total_spent: 11000,
        alert_sent: true, // Already sent
        alert_sent_at: new Date().toISOString(),
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "budget_tracking") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockBudget }),
          };
        }
      });

      const alerts = await AlertService.checkBudgetAlerts(mockUserId);

      expect(alerts).toHaveLength(0);
    });

    it("should not generate alerts when budget is below 80%", async () => {
      const mockBudget = {
        user_id: mockUserId,
        month: 11,
        year: 2025,
        budget_limit: 10000,
        total_spent: 5000, // 50%
        alert_sent: false,
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "budget_tracking") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockBudget }),
          };
        }
      });

      const alerts = await AlertService.checkBudgetAlerts(mockUserId);

      expect(alerts).toHaveLength(0);
    });
  });

  describe("getUserAlerts", () => {
    it("should return all alerts for a user", async () => {
      const mockAlerts = [
        {
          id: "alert-1",
          alert_type: "budget_warning",
          priority: "medium",
          is_read: false,
        },
        {
          id: "alert-2",
          alert_type: "budget_exceeded",
          priority: "high",
          is_read: false,
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockAlerts }),
      });

      const result = await AlertService.getUserAlerts(mockUserId);

      expect(result).toHaveLength(2);
      expect(result).toEqual(mockAlerts);
    });

    it("should filter unread alerts", async () => {
      const mockAlerts = [
        {
          id: "alert-1",
          alert_type: "budget_warning",
          is_read: false,
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockAlerts }),
      });

      const result = await AlertService.getUserAlerts(mockUserId, {
        unreadOnly: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].is_read).toBe(false);
    });

    it("should return empty array when no alerts exist", async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [] }),
      });

      const result = await AlertService.getUserAlerts(mockUserId);

      expect(result).toHaveLength(0);
    });
  });

  describe("markAsRead", () => {
    it("should mark an alert as read", async () => {
      const mockUpdate = jest.fn().mockResolvedValue({
        data: { id: "alert-1", is_read: true },
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: "alert-1", is_read: true },
        }),
      });

      const result = await AlertService.markAsRead("alert-1");

      expect(mockUpdate).toHaveBeenCalledWith({ is_read: true });
      expect(result.is_read).toBe(true);
    });

    it("should handle errors when marking as read", async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Alert not found" },
        }),
      });

      await expect(AlertService.markAsRead("invalid-id")).rejects.toThrow();
    });
  });

  describe("deleteAlert", () => {
    it("should delete an alert", async () => {
      const mockDelete = jest.fn().mockResolvedValue({
        data: {},
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        delete: mockDelete,
        eq: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      await AlertService.deleteAlert("alert-1");

      expect(mockDelete).toHaveBeenCalled();
    });

    it("should handle errors when deleting", async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        delete: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Delete failed" },
        }),
      });

      await expect(AlertService.deleteAlert("invalid-id")).rejects.toThrow();
    });
  });

  describe("alert metadata handling", () => {
    it("should store and retrieve metadata correctly", async () => {
      const metadata = {
        budget_limit: 10000,
        total_spent: 9500,
        overspent: 0,
        threshold: 95,
      };

      const mockInsert = jest.fn().mockResolvedValue({
        data: { metadata },
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { metadata } }),
      });

      const result = await AlertService.create({
        user_id: mockUserId,
        alert_type: "budget_warning",
        priority: "medium",
        title: "Test",
        message: "Test",
        metadata,
      });

      expect(result.metadata).toEqual(metadata);
    });
  });
});
