import { EnhancedAlertService } from "./alerts.service";
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

describe("EnhancedAlertService", () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn(),
    };

    (supabase.from as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe("createAlertFromTemplate", () => {
    it("should create alert from template successfully", async () => {
      const mockTemplate = {
        id: "template-1",
        alert_type: "budget_exceeded",
        priority: "high",
        title_template: "Budget Exceeded: {{category}}",
        message_template: "You have exceeded your budget for {{category}} by {{amount}}",
        action_label: "View Budget",
        action_url_template: "/budgets/{{categoryId}}",
        default_channels: ["email", "push"],
        is_active: true,
      };

      const mockAlert = {
        id: "alert-1",
        user_id: "user-123",
        alert_type: "budget_exceeded",
        priority: "high",
        title: "Budget Exceeded: Groceries",
        message: "You have exceeded your budget for Groceries by $50",
        action_url: "/budgets/grocery-123",
        action_label: "View Budget",
        created_at: "2025-01-01T00:00:00Z",
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: mockTemplate, error: null })
        .mockResolvedValueOnce({ data: mockAlert, error: null });

      const result = await EnhancedAlertService.createAlertFromTemplate(
        "user-123",
        "budget_exceeded",
        "high",
        {
          category: "Groceries",
          amount: "$50",
          categoryId: "grocery-123",
        }
      );

      expect(result).toEqual(mockAlert);
      expect(supabase.from).toHaveBeenCalledWith("alert_templates");
      expect(supabase.from).toHaveBeenCalledWith("alerts");
    });

    it("should throw AppError if template not found", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: "Template not found" },
      });

      await expect(
        EnhancedAlertService.createAlertFromTemplate("user-123", "invalid_type", "high", {})
      ).rejects.toThrow(AppError);
    });
  });

  describe("getNotificationPreferences", () => {
    it("should retrieve user notification preferences", async () => {
      const mockPreferences = {
        id: "pref-1",
        user_id: "user-123",
        email_enabled: true,
        push_enabled: true,
        sms_enabled: false,
        channels: ["email", "push"],
        quiet_hours_start: "22:00",
        quiet_hours_end: "08:00",
      };

      mockSupabase.single.mockResolvedValue({ data: mockPreferences, error: null });

      const result = await EnhancedAlertService.getNotificationPreferences("user-123");

      expect(result).toEqual(mockPreferences);
      expect(mockSupabase.eq).toHaveBeenCalledWith("user_id", "user-123");
    });

    it("should return default preferences if none exist", async () => {
      const defaultPreferences = {
        id: "pref-new",
        user_id: "user-123",
        email_enabled: true,
        push_enabled: false,
        sms_enabled: false,
        channels: ["email"],
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } })
        .mockResolvedValueOnce({ data: defaultPreferences, error: null });

      const result = await EnhancedAlertService.getNotificationPreferences("user-123");

      expect(result).toEqual(defaultPreferences);
    });
  });

  describe("updateNotificationPreferences", () => {
    it("should update notification preferences successfully", async () => {
      const updatedPreferences = {
        id: "pref-1",
        user_id: "user-123",
        email_enabled: false,
        push_enabled: true,
        sms_enabled: true,
        channels: ["push", "sms"],
      };

      mockSupabase.single.mockResolvedValue({ data: updatedPreferences, error: null });

      const result = await EnhancedAlertService.updateNotificationPreferences("user-123", {
        email_enabled: false,
        sms_enabled: true,
      });

      expect(result).toEqual(updatedPreferences);
      expect(mockSupabase.update).toHaveBeenCalled();
    });
  });

  describe("createAlertRule", () => {
    it("should create a new alert rule", async () => {
      const mockRule = {
        id: "rule-1",
        user_id: "user-123",
        rule_name: "High Spending Alert",
        rule_type: "spending_threshold",
        condition: { threshold: 500, period: "daily" },
        alert_priority: "high",
        alert_channels: ["email", "push"],
        is_active: true,
        created_at: "2025-01-01T00:00:00Z",
      };

      mockSupabase.single.mockResolvedValue({ data: mockRule, error: null });

      const result = await EnhancedAlertService.createAlertRule(
        "user-123",
        "High Spending Alert",
        "spending_threshold",
        { threshold: 500, period: "daily" },
        "high",
        ["email", "push"]
      );

      expect(result).toEqual(mockRule);
      expect(supabase.from).toHaveBeenCalledWith("alert_rules");
    });

    it("should throw AppError on creation failure", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: "Creation failed" },
      });

      await expect(
        EnhancedAlertService.createAlertRule(
          "user-123",
          "Test Rule",
          "spending_threshold",
          {},
          "medium",
          ["email"]
        )
      ).rejects.toThrow(AppError);
    });
  });

  describe("getAlertRules", () => {
    it("should fetch all active alert rules", async () => {
      const mockRules = [
        {
          id: "rule-1",
          user_id: "user-123",
          rule_name: "Rule 1",
          rule_type: "spending_threshold",
          is_active: true,
        },
        {
          id: "rule-2",
          user_id: "user-123",
          rule_name: "Rule 2",
          rule_type: "bill_reminder",
          is_active: true,
        },
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            eq: jest.fn().mockResolvedValueOnce({ data: mockRules, error: null }),
          }),
        }),
      });

      const result = await EnhancedAlertService.getAlertRules("user-123", true);

      expect(result).toHaveLength(2);
      expect(result[0].rule_name).toBe("Rule 1");
    });

    it("should fetch all rules including inactive when activeOnly is false", async () => {
      const mockRules = [
        {
          id: "rule-1",
          user_id: "user-123",
          rule_name: "Active Rule",
          is_active: true,
        },
        {
          id: "rule-2",
          user_id: "user-123",
          rule_name: "Inactive Rule",
          is_active: false,
        },
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockResolvedValueOnce({ data: mockRules, error: null }),
        }),
      });

      const result = await EnhancedAlertService.getAlertRules("user-123", false);

      expect(result).toHaveLength(2);
    });
  });

  describe("updateAlertRule", () => {
    it("should update an alert rule successfully", async () => {
      const updatedRule = {
        id: "rule-1",
        user_id: "user-123",
        rule_name: "Updated Rule",
        is_active: false,
        updated_at: new Date().toISOString(),
      };

      mockSupabase.single.mockResolvedValue({ data: updatedRule, error: null });

      const result = await EnhancedAlertService.updateAlertRule("rule-1", "user-123", {
        rule_name: "Updated Rule",
        is_active: false,
      });

      expect(result.rule_name).toBe("Updated Rule");
      expect(mockSupabase.update).toHaveBeenCalled();
    });
  });

  describe("deleteAlertRule", () => {
    it("should soft delete an alert rule", async () => {
      mockSupabase.single.mockResolvedValue({ data: {}, error: null });

      await EnhancedAlertService.deleteAlertRule("rule-1", "user-123");

      expect(mockSupabase.update).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith("id", "rule-1");
    });

    it("should throw AppError on deletion failure", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: "Deletion failed" },
      });

      await expect(EnhancedAlertService.deleteAlertRule("rule-1", "user-123")).rejects.toThrow(
        AppError
      );
    });
  });

  describe("getAlertDeliveryStatus", () => {
    it("should fetch delivery logs for an alert", async () => {
      const mockLogs = [
        {
          id: "log-1",
          alert_id: "alert-1",
          channel: "email",
          delivery_status: "sent",
          sent_at: "2025-01-01T10:00:00Z",
        },
        {
          id: "log-2",
          alert_id: "alert-1",
          channel: "push",
          delivery_status: "delivered",
          sent_at: "2025-01-01T10:00:05Z",
        },
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockResolvedValueOnce({ data: mockLogs, error: null }),
        }),
      });

      const result = await EnhancedAlertService.getAlertDeliveryStatus("alert-1");

      expect(result).toHaveLength(2);
      expect(result[0].channel).toBe("email");
    });
  });

  describe("getDeliveryStatistics", () => {
    it("should calculate delivery statistics for a user", async () => {
      const mockLogs = [
        { delivery_status: "sent", channel: "email" },
        { delivery_status: "delivered", channel: "push" },
        { delivery_status: "failed", channel: "sms" },
        { delivery_status: "delivered", channel: "email" },
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockResolvedValueOnce({ data: mockLogs, error: null }),
        }),
      });

      const result = await EnhancedAlertService.getDeliveryStatistics("user-123");

      expect(result).toBeDefined();
      expect(result.total).toBe(4);
      expect(result.by_channel.email).toBeDefined();
    });
  });

  describe("recordInteraction", () => {
    it("should record user interaction with an alert", async () => {
      const mockInteraction = {
        id: "interaction-1",
        alert_id: "alert-1",
        user_id: "user-123",
        interaction_type: "clicked",
        timestamp: new Date().toISOString(),
      };

      mockSupabase.single.mockResolvedValue({ data: mockInteraction, error: null });

      const result = await EnhancedAlertService.recordInteraction("alert-1", "user-123", "clicked");

      expect(result).toEqual(mockInteraction);
      expect(supabase.from).toHaveBeenCalledWith("alert_interactions");
    });
  });

  describe("getAlertAnalytics", () => {
    it("should retrieve alert analytics for date range", async () => {
      const mockAnalytics = {
        total_sent: 150,
        total_delivered: 140,
        total_failed: 10,
        delivery_rate: 93.33,
        by_type: {
          budget_exceeded: 50,
          bill_reminder: 60,
          payment_due: 40,
        },
        by_channel: {
          email: 80,
          push: 60,
          sms: 10,
        },
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const result = await EnhancedAlertService.getAlertAnalytics(
        "user-123",
        new Date("2025-01-01"),
        new Date("2025-01-31")
      );

      expect(result).toBeDefined();
    });
  });

  describe("generateDigest", () => {
    it("should generate daily digest for user", async () => {
      const mockDigest = {
        id: "digest-1",
        user_id: "user-123",
        digest_type: "daily",
        summary: {
          new_alerts: 5,
          unread_alerts: 3,
          top_categories: ["Groceries", "Entertainment"],
        },
        created_at: new Date().toISOString(),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      mockSupabase.single.mockResolvedValue({ data: mockDigest, error: null });

      const result = await EnhancedAlertService.generateDigest("user-123", "daily");

      expect(result).toBeDefined();
    });

    it("should generate weekly digest for user", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await EnhancedAlertService.generateDigest("user-123", "weekly");

      expect(result).toBeDefined();
    });
  });

  describe("markDigestAsSent", () => {
    it("should mark digest as sent successfully", async () => {
      mockSupabase.single.mockResolvedValue({ data: {}, error: null });

      await EnhancedAlertService.markDigestAsSent("digest-1");

      expect(mockSupabase.update).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith("id", "digest-1");
    });
  });

  describe("batchSendNotifications", () => {
    it("should process pending notifications in batch", async () => {
      const mockPendingAlerts = [
        {
          id: "alert-1",
          user_id: "user-123",
          alert_type: "budget_exceeded",
          priority: "high",
        },
        {
          id: "alert-2",
          user_id: "user-456",
          alert_type: "bill_reminder",
          priority: "medium",
        },
      ];

      mockSupabase.limit.mockResolvedValue({ data: mockPendingAlerts, error: null });
      mockSupabase.single.mockResolvedValue({ data: {}, error: null });

      const result = await EnhancedAlertService.batchSendNotifications();

      expect(result).toBeDefined();
      expect(result.processed).toBeGreaterThanOrEqual(0);
    });
  });
});
