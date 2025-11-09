/**
 * Bills Service Unit Tests
 * Tests bill date calculation, reminder creation, and payment recording
 */

import { BillReminderService } from "./bills.service";
import { createSupabaseMock, createMockResponse } from "../../__tests__/test-utils/supabase-mock";
import { AppError } from "shared/errors/AppError";

// Mock Supabase
const { supabase: mockSupabase, setReturnValue, setError, reset } = createSupabaseMock();

jest.mock("shared/database/supabase", () => ({
  supabase: mockSupabase,
}));

// Mock logger
jest.mock("shared/monitoring/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock alerts service
jest.mock("../alerts/alerts.service", () => ({
  EnhancedAlertService: {
    createAlertFromTemplate: jest.fn().mockResolvedValue({ id: "alert-001" }),
  },
}));

describe("BillReminderService", () => {
  beforeEach(() => {
    reset();
    jest.clearAllMocks();
  });

  describe("calculateNextBillDate", () => {
    it("should calculate next bill date without last bill date", () => {
      const billingCycleDay = 5;
      const today = new Date("2024-01-10"); // After the 5th

      jest.spyOn(global, "Date").mockImplementation((dateStr?: any) => {
        if (dateStr) return new Date(dateStr) as any;
        return today as any;
      });

      const nextBillDate = BillReminderService.calculateNextBillDate("card-001", billingCycleDay);

      expect(nextBillDate.getDate()).toBe(5);
      expect(nextBillDate.getMonth()).toBe(1); // February (0-indexed)

      jest.restoreAllMocks();
    });

    it("should handle month-end edge cases (Jan 31 -> Feb 28)", () => {
      const lastBillDate = new Date("2024-01-31");
      const billingCycleDay = 31;

      const nextBillDate = BillReminderService.calculateNextBillDate(
        "card-001",
        billingCycleDay,
        lastBillDate
      );

      // Feb 2024 has 29 days (leap year)
      expect(nextBillDate.getDate()).toBeLessThanOrEqual(29);
      expect(nextBillDate.getMonth()).toBe(1); // February
    });

    it("should correctly advance to next month when billing day has passed", () => {
      const billingCycleDay = 5;
      const today = new Date("2024-01-06"); // After the 5th

      jest.spyOn(global, "Date").mockImplementation((dateStr?: any) => {
        if (dateStr) return new Date(dateStr) as any;
        return today as any;
      });

      const nextBillDate = BillReminderService.calculateNextBillDate("card-001", billingCycleDay);

      expect(nextBillDate.getDate()).toBe(5);
      expect(nextBillDate.getMonth()).toBe(1); // February

      jest.restoreAllMocks();
    });

    it("should handle leap year correctly", () => {
      const lastBillDate = new Date("2024-01-29");
      const billingCycleDay = 29;

      const nextBillDate = BillReminderService.calculateNextBillDate(
        "card-001",
        billingCycleDay,
        lastBillDate
      );

      expect(nextBillDate.getDate()).toBe(29);
      expect(nextBillDate.getMonth()).toBe(1); // February 2024 (leap year)
    });
  });

  describe("calculateDueDate", () => {
    it("should calculate due date 20 days after bill date by default", () => {
      const billDate = new Date("2024-01-05");
      const dueDate = BillReminderService.calculateDueDate(billDate);

      expect(dueDate.getDate()).toBe(25);
      expect(dueDate.getMonth()).toBe(0); // Same month (January)
    });

    it("should handle due date crossing month boundary", () => {
      const billDate = new Date("2024-01-20");
      const dueDate = BillReminderService.calculateDueDate(billDate, 20);

      expect(dueDate.getDate()).toBe(9);
      expect(dueDate.getMonth()).toBe(1); // February
    });

    it("should accept custom payment due days", () => {
      const billDate = new Date("2024-01-05");
      const dueDate = BillReminderService.calculateDueDate(billDate, 25);

      expect(dueDate.getDate()).toBe(30);
      expect(dueDate.getMonth()).toBe(0); // January
    });
  });

  describe("calculateStatementPeriod", () => {
    it("should calculate statement period correctly", () => {
      const billDate = new Date("2024-02-05");
      const period = BillReminderService.calculateStatementPeriod(billDate);

      expect(period.start.getDate()).toBe(5);
      expect(period.start.getMonth()).toBe(0); // January
      expect(period.end.getDate()).toBe(4);
      expect(period.end.getMonth()).toBe(1); // February
    });

    it("should handle year boundary", () => {
      const billDate = new Date("2024-01-05");
      const period = BillReminderService.calculateStatementPeriod(billDate);

      expect(period.start.getMonth()).toBe(11); // December
      expect(period.start.getFullYear()).toBe(2023);
      expect(period.end.getMonth()).toBe(0); // January
      expect(period.end.getFullYear()).toBe(2024);
    });
  });

  describe("generateBillsForAllCards", () => {
    it("should generate bills for all active cards", async () => {
      const mockCards = [
        {
          id: "card-001",
          user_id: "user-123",
          billing_cycle_day: 5,
          payment_due_days: 20,
          is_active: true,
          current_outstanding: 10000,
        },
        {
          id: "card-002",
          user_id: "user-123",
          billing_cycle_day: 10,
          payment_due_days: 20,
          is_active: true,
          current_outstanding: 5000,
        },
      ];

      setReturnValue("credit_cards", "select", createMockResponse(mockCards));

      // Mock bill generation for each card
      jest.spyOn(BillReminderService, "generateBillForCard").mockResolvedValue({
        generated: true,
        updated: false,
      });

      const result = await BillReminderService.generateBillsForAllCards();

      expect(result.generated).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(BillReminderService.generateBillForCard).toHaveBeenCalledTimes(2);
    });

    it("should handle errors for individual cards", async () => {
      const mockCards = [
        { id: "card-001", is_active: true, billing_cycle_day: 5 },
        { id: "card-002", is_active: true, billing_cycle_day: 10 },
      ];

      setReturnValue("credit_cards", "select", createMockResponse(mockCards));

      jest
        .spyOn(BillReminderService, "generateBillForCard")
        .mockResolvedValueOnce({ generated: true, updated: false })
        .mockRejectedValueOnce(new Error("Database error"));

      const result = await BillReminderService.generateBillsForAllCards();

      expect(result.generated).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("card-002");
    });

    it("should return appropriate message when no active cards found", async () => {
      setReturnValue("credit_cards", "select", createMockResponse(null));

      const result = await BillReminderService.generateBillsForAllCards();

      expect(result.generated).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.errors).toContain("No active cards found");
    });
  });

  describe("createReminderRecords", () => {
    it("should create reminders based on settings", async () => {
      const userId = "user-123";
      const mockSettings = {
        user_id: userId,
        enable_reminders: true,
        reminder_days: [7, 3, 1],
        channels: ["email", "in_app"],
      };

      const mockBills = [
        {
          id: "bill-001",
          user_id: userId,
          card_id: "card-001",
          due_date: new Date("2024-02-25"),
          total_amount: 10000,
          status: "pending",
        },
      ];

      setReturnValue("bill_reminder_settings", "select", createMockResponse([mockSettings]));
      setReturnValue("bills", "select", createMockResponse(mockBills));
      setReturnValue("bill_reminders", "insert", createMockResponse({ id: "reminder-001" }));

      const result = await BillReminderService.createReminderRecords(userId);

      expect(result.remindersCreated).toBeGreaterThan(0);
      expect(mockSupabase.from).toHaveBeenCalledWith("bill_reminders");
    });

    it("should skip reminder creation when disabled", async () => {
      const userId = "user-123";
      const mockSettings = {
        user_id: userId,
        enable_reminders: false,
        reminder_days: [7, 3, 1],
      };

      setReturnValue("bill_reminder_settings", "select", createMockResponse([mockSettings]));

      const result = await BillReminderService.createReminderRecords(userId);

      expect(result.remindersCreated).toBe(0);
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it("should create reminders with correct priority based on days", async () => {
      const userId = "user-123";
      const mockSettings = {
        user_id: userId,
        enable_reminders: true,
        reminder_days: [7, 3, 1],
        channels: ["email"],
      };

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 10);

      const mockBills = [
        {
          id: "bill-001",
          user_id: userId,
          card_id: "card-001",
          due_date: dueDate.toISOString(),
          total_amount: 10000,
          status: "pending",
        },
      ];

      setReturnValue("bill_reminder_settings", "select", createMockResponse([mockSettings]));
      setReturnValue("bills", "select", createMockResponse(mockBills));
      setReturnValue("bill_reminders", "insert", createMockResponse({ id: "reminder-001" }));

      const result = await BillReminderService.createReminderRecords(userId);

      // Should create 3 reminders (7, 3, 1 days before)
      expect(result.remindersCreated).toBe(3);
    });
  });

  describe("recordPayment", () => {
    it("should record payment and update card outstanding", async () => {
      const paymentData = {
        userId: "user-123",
        cardId: "card-001",
        billId: "bill-001",
        amount: 5000,
        paymentMethod: "manual" as const,
      };

      const mockCard = {
        id: "card-001",
        current_outstanding: 10000,
      };

      const mockBill = {
        id: "bill-001",
        total_amount: 10000,
        status: "pending",
      };

      setReturnValue("credit_cards", "select", createMockResponse([mockCard]));
      setReturnValue("bills", "select", createMockResponse([mockBill]));
      setReturnValue("payments", "insert", createMockResponse({ id: "payment-001" }));
      setReturnValue(
        "credit_cards",
        "update",
        createMockResponse({ ...mockCard, current_outstanding: 5000 })
      );
      setReturnValue("bills", "update", createMockResponse({ ...mockBill, status: "paid" }));

      const result = await BillReminderService.recordPayment(paymentData);

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("payments");
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it("should handle partial payments correctly", async () => {
      const paymentData = {
        userId: "user-123",
        cardId: "card-001",
        billId: "bill-001",
        amount: 3000,
        paymentMethod: "manual" as const,
      };

      const mockCard = {
        id: "card-001",
        current_outstanding: 10000,
      };

      const mockBill = {
        id: "bill-001",
        total_amount: 10000,
        paid_amount: 0,
        status: "pending",
      };

      setReturnValue("credit_cards", "select", createMockResponse([mockCard]));
      setReturnValue("bills", "select", createMockResponse([mockBill]));
      setReturnValue("payments", "insert", createMockResponse({ id: "payment-001" }));
      setReturnValue(
        "credit_cards",
        "update",
        createMockResponse({ ...mockCard, current_outstanding: 7000 })
      );
      setReturnValue(
        "bills",
        "update",
        createMockResponse({
          ...mockBill,
          paid_amount: 3000,
          status: "pending", // Still pending as not fully paid
        })
      );

      const result = await BillReminderService.recordPayment(paymentData);

      expect(result.success).toBe(true);
      expect(result.remainingAmount).toBeGreaterThan(0);
    });

    it("should throw error when card not found", async () => {
      const paymentData = {
        userId: "user-123",
        cardId: "invalid-card",
        billId: "bill-001",
        amount: 5000,
        paymentMethod: "manual" as const,
      };

      setReturnValue("credit_cards", "select", createMockResponse(null));

      await expect(BillReminderService.recordPayment(paymentData)).rejects.toThrow();
    });

    it("should throw error when payment amount exceeds bill amount", async () => {
      const paymentData = {
        userId: "user-123",
        cardId: "card-001",
        billId: "bill-001",
        amount: 15000,
        paymentMethod: "manual" as const,
      };

      const mockCard = {
        id: "card-001",
        current_outstanding: 10000,
      };

      const mockBill = {
        id: "bill-001",
        total_amount: 10000,
        status: "pending",
      };

      setReturnValue("credit_cards", "select", createMockResponse([mockCard]));
      setReturnValue("bills", "select", createMockResponse([mockBill]));

      await expect(BillReminderService.recordPayment(paymentData)).rejects.toThrow();
    });
  });

  describe("getUpcomingBills", () => {
    it("should fetch upcoming bills within date range", async () => {
      const userId = "user-123";
      const mockBills = [
        {
          id: "bill-001",
          user_id: userId,
          due_date: new Date("2024-02-25"),
          total_amount: 10000,
          status: "pending",
        },
        {
          id: "bill-002",
          user_id: userId,
          due_date: new Date("2024-03-05"),
          total_amount: 5000,
          status: "pending",
        },
      ];

      setReturnValue("bills", "select", createMockResponse(mockBills));

      const result = await BillReminderService.getUpcomingBills(userId, 30);

      expect(result.length).toBe(2);
      expect(mockSupabase.from).toHaveBeenCalledWith("bills");
    });

    it("should only return pending bills", async () => {
      const userId = "user-123";
      const mockBills = [
        {
          id: "bill-001",
          user_id: userId,
          due_date: new Date("2024-02-25"),
          status: "pending",
        },
      ];

      setReturnValue("bills", "select", createMockResponse(mockBills));

      await BillReminderService.getUpcomingBills(userId, 30);

      expect(mockSupabase.eq).toHaveBeenCalledWith("status", "pending");
    });
  });

  describe("Error Handling", () => {
    it("should throw AppError on database failure in generateBillsForAllCards", async () => {
      setError("credit_cards", "select", new Error("Database connection failed"));

      await expect(BillReminderService.generateBillsForAllCards()).rejects.toThrow(AppError);
    });

    it("should handle missing card data gracefully", async () => {
      setReturnValue("credit_cards", "select", createMockResponse(null));

      await expect(BillReminderService.generateBillForCard("invalid-card")).rejects.toThrow();
    });
  });
});
