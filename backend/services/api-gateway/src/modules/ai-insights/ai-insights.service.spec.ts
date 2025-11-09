/**
 * AI Insights Service Unit Tests
 * Tests recommendation generation, anomaly detection, and confidence thresholds
 */

import { AIInsightsService } from "./ai-insights.service";
import { createSupabaseMock, createMockResponse } from "../../__tests__/test-utils/supabase-mock";

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

describe("AIInsightsService", () => {
  const mockUserId = "user-test-123";

  beforeEach(() => {
    reset();
    jest.clearAllMocks();
  });

  describe("generateSpendingInsights", () => {
    it("should generate insights for top spending categories", async () => {
      const mockTransactions = [
        {
          id: "txn-001",
          user_id: mockUserId,
          category: "shopping",
          amount: 25000,
          transaction_date: new Date("2024-01-15"),
        },
        {
          id: "txn-002",
          user_id: mockUserId,
          category: "shopping",
          amount: 15000,
          transaction_date: new Date("2024-01-20"),
        },
        {
          id: "txn-003",
          user_id: mockUserId,
          category: "food",
          amount: 8000,
          transaction_date: new Date("2024-01-22"),
        },
      ];

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));

      const result = await AIInsightsService.generateSpendingInsights(mockUserId);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("category");
      expect(result[0]).toHaveProperty("recommendation");
      expect(result[0]).toHaveProperty("confidence");
    });

    it("should identify unusual spending patterns", async () => {
      const mockTransactions = [
        {
          id: "txn-001",
          user_id: mockUserId,
          category: "entertainment",
          amount: 50000, // Unusually high
          transaction_date: new Date("2024-01-15"),
        },
        {
          id: "txn-002",
          user_id: mockUserId,
          category: "entertainment",
          amount: 2000, // Normal
          transaction_date: new Date("2024-01-10"),
        },
      ];

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));

      const result = await AIInsightsService.generateSpendingInsights(mockUserId);

      const anomalyInsight = result.find((insight: { type: string }) => insight.type === "anomaly");
      expect(anomalyInsight).toBeDefined();
    });

    it("should compare spending with previous periods", async () => {
      const mockTransactions = [
        {
          id: "txn-001",
          user_id: mockUserId,
          category: "groceries",
          amount: 15000,
          transaction_date: new Date("2024-01-15"),
        },
      ];

      const mockPreviousTransactions = [
        {
          id: "txn-old",
          user_id: mockUserId,
          category: "groceries",
          amount: 10000,
          transaction_date: new Date("2023-12-15"),
        },
      ];

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));

      const result = await AIInsightsService.generateSpendingInsights(mockUserId);

      const trendInsight = result.find((insight: { type: string }) => insight.type === "trend");
      expect(trendInsight).toBeDefined();
    });

    it("should provide high confidence for consistent patterns", async () => {
      const mockTransactions = Array.from({ length: 10 }, (_, i) => ({
        id: `txn-00${i}`,
        user_id: mockUserId,
        category: "fuel",
        amount: 5000 + Math.random() * 500, // Consistent spending
        transaction_date: new Date(`2024-01-${i + 1}`),
      }));

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));

      const result = await AIInsightsService.generateSpendingInsights(mockUserId);

      expect(result.some((insight: { confidence: number }) => insight.confidence >= 80)).toBe(true);
    });

    it("should provide fallback recommendations when data is limited", async () => {
      const mockTransactions = [
        {
          id: "txn-001",
          user_id: mockUserId,
          category: "other",
          amount: 1000,
          transaction_date: new Date("2024-01-15"),
        },
      ];

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));

      const result = await AIInsightsService.generateSpendingInsights(mockUserId);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("detectAnomalies", () => {
    it("should detect spending anomalies based on historical data", async () => {
      const mockTransactions = [
        {
          id: "txn-001",
          user_id: mockUserId,
          amount: 50000, // Anomaly
          category: "shopping",
          merchant_name: "Large Purchase",
          transaction_date: new Date("2024-01-15"),
        },
        ...Array.from({ length: 20 }, (_, i) => ({
          id: `txn-00${i}`,
          user_id: mockUserId,
          amount: 2000 + Math.random() * 500, // Normal range
          category: "shopping",
          transaction_date: new Date(`2024-01-${i + 1}`),
        })),
      ];

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));

      const result = await AIInsightsService.detectAnomalies(mockUserId);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("transactionId");
      expect(result[0]).toHaveProperty("severity");
      expect(result[0]).toHaveProperty("reason");
    });

    it("should detect unusual merchant transactions", async () => {
      const mockTransactions = [
        {
          id: "txn-001",
          user_id: mockUserId,
          amount: 10000,
          merchant_name: "UNKNOWN MERCHANT",
          category: "other",
          transaction_date: new Date("2024-01-15"),
        },
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `txn-00${i}`,
          user_id: mockUserId,
          amount: 2000,
          merchant_name: "Amazon",
          category: "shopping",
          transaction_date: new Date(`2024-01-${i + 1}`),
        })),
      ];

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));

      const result = await AIInsightsService.detectAnomalies(mockUserId);

      const merchantAnomaly = result.find(
        (anomaly: { type: string }) => anomaly.type === "unusual_merchant"
      );
      expect(merchantAnomaly).toBeDefined();
    });

    it("should detect time-based anomalies (e.g., late-night transactions)", async () => {
      const lateNightDate = new Date("2024-01-15T02:30:00Z");

      const mockTransactions = [
        {
          id: "txn-001",
          user_id: mockUserId,
          amount: 5000,
          merchant_name: "Late Night Store",
          transaction_date: lateNightDate.toISOString(),
        },
      ];

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));

      const result = await AIInsightsService.detectAnomalies(mockUserId);

      const timeAnomaly = result.find(
        (anomaly: { type: string }) => anomaly.type === "unusual_time"
      );
      expect(timeAnomaly).toBeDefined();
    });

    it("should return empty array when no anomalies detected", async () => {
      const mockTransactions = Array.from({ length: 10 }, (_, i) => ({
        id: `txn-00${i}`,
        user_id: mockUserId,
        amount: 2000 + Math.random() * 200, // Consistent
        category: "shopping",
        transaction_date: new Date(`2024-01-${i + 1}`),
      }));

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));

      const result = await AIInsightsService.detectAnomalies(mockUserId);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(0);
    });
  });

  describe("generateBudgetRecommendations", () => {
    it("should recommend budget adjustments based on spending trends", async () => {
      const mockTransactions = [
        {
          id: "txn-001",
          user_id: mockUserId,
          category: "food",
          amount: 12000,
          transaction_date: new Date("2024-01-15"),
        },
      ];

      const mockBudgets = [
        {
          id: "budget-001",
          user_id: mockUserId,
          category: "food",
          budget_limit: 8000, // Under budget
          total_spent: 12000,
        },
      ];

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));
      setReturnValue("budgets", "select", createMockResponse(mockBudgets));

      const result = await AIInsightsService.generateBudgetRecommendations(mockUserId);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("category");
      expect(result[0]).toHaveProperty("recommendedLimit");
      expect(result[0]).toHaveProperty("reason");
    });

    it("should suggest new budget categories based on spending", async () => {
      const mockTransactions = [
        {
          id: "txn-001",
          user_id: mockUserId,
          category: "travel",
          amount: 50000,
          transaction_date: new Date("2024-01-15"),
        },
      ];

      const mockBudgets: any[] = []; // No existing budget for travel

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));
      setReturnValue("budgets", "select", createMockResponse(mockBudgets));

      const result = await AIInsightsService.generateBudgetRecommendations(mockUserId);

      const newCategoryRecommendation = result.find(
        (rec: { type: string }) => rec.type === "new_category"
      );
      expect(newCategoryRecommendation).toBeDefined();
    });

    it("should calculate realistic budget limits based on historical spending", async () => {
      const mockTransactions = Array.from({ length: 3 }, (_, month) =>
        Array.from({ length: 10 }, (__, i) => ({
          id: `txn-${month}-${i}`,
          user_id: mockUserId,
          category: "groceries",
          amount: 8000 + Math.random() * 2000, // Average ~9000
          transaction_date: new Date(`2024-0${month + 1}-${i + 1}`),
        }))
      ).flat();

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));
      setReturnValue("budgets", "select", createMockResponse([]));

      const result = await AIInsightsService.generateBudgetRecommendations(mockUserId);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].recommendedLimit).toBeGreaterThan(8000);
      expect(result[0].recommendedLimit).toBeLessThan(12000);
    });
  });

  describe("predictFutureSpending", () => {
    it("should predict next month spending based on trends", async () => {
      const mockTransactions = Array.from({ length: 60 }, (_, i) => ({
        id: `txn-00${i}`,
        user_id: mockUserId,
        category: "shopping",
        amount: 10000 + i * 100, // Increasing trend
        transaction_date: new Date(new Date().setDate(new Date().getDate() - (60 - i))),
      }));

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));

      const result = await AIInsightsService.predictFutureSpending(mockUserId);

      expect(result).toHaveProperty("predictions");
      expect(result.predictions).toBeInstanceOf(Array);
      expect(result.predictions.length).toBeGreaterThan(0);
      expect(result.predictions[0]).toHaveProperty("category");
      expect(result.predictions[0]).toHaveProperty("predictedAmount");
      expect(result.predictions[0]).toHaveProperty("confidence");
    });

    it("should account for seasonal variations", async () => {
      const mockTransactions = [
        {
          id: "txn-001",
          user_id: mockUserId,
          category: "travel",
          amount: 50000,
          transaction_date: new Date("2023-12-25"), // Holiday season
        },
        {
          id: "txn-002",
          user_id: mockUserId,
          category: "travel",
          amount: 10000,
          transaction_date: new Date("2024-01-15"), // Regular
        },
      ];

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));

      const result = await AIInsightsService.predictFutureSpending(mockUserId);

      expect(result.predictions).toBeDefined();
    });

    it("should provide low confidence for insufficient historical data", async () => {
      const mockTransactions = [
        {
          id: "txn-001",
          user_id: mockUserId,
          category: "other",
          amount: 1000,
          transaction_date: new Date("2024-01-15"),
        },
      ];

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));

      const result = await AIInsightsService.predictFutureSpending(mockUserId);

      if (result.predictions.length > 0) {
        expect(result.predictions[0].confidence).toBeLessThan(50);
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      setError("transactions", "select", new Error("Database error"));

      await expect(AIInsightsService.generateSpendingInsights(mockUserId)).rejects.toThrow();
    });

    it("should return empty insights when no transactions exist", async () => {
      setReturnValue("transactions", "select", createMockResponse([]));

      const result = await AIInsightsService.generateSpendingInsights(mockUserId);

      expect(result).toBeInstanceOf(Array);
    });

    it("should handle null/undefined data gracefully", async () => {
      setReturnValue("transactions", "select", createMockResponse(null));

      await expect(AIInsightsService.generateSpendingInsights(mockUserId)).rejects.toThrow();
    });
  });

  describe("Confidence Thresholds", () => {
    it("should assign high confidence for well-established patterns", async () => {
      const mockTransactions = Array.from({ length: 100 }, (_, i) => ({
        id: `txn-00${i}`,
        user_id: mockUserId,
        category: "utilities",
        amount: 3000 + Math.random() * 100, // Very consistent
        transaction_date: new Date(new Date().setDate(new Date().getDate() - (100 - i))),
      }));

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));

      const result = await AIInsightsService.generateSpendingInsights(mockUserId);

      const highConfidenceInsights = result.filter(
        (insight: { confidence: number }) => insight.confidence >= 85
      );
      expect(highConfidenceInsights.length).toBeGreaterThan(0);
    });

    it("should assign low confidence for volatile patterns", async () => {
      const mockTransactions = Array.from({ length: 10 }, (_, i) => ({
        id: `txn-00${i}`,
        user_id: mockUserId,
        category: "entertainment",
        amount: Math.random() * 20000, // High variance
        transaction_date: new Date(`2024-01-${i + 1}`),
      }));

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));

      const result = await AIInsightsService.generateSpendingInsights(mockUserId);

      expect(result.some((insight: { confidence: number }) => insight.confidence < 60)).toBe(true);
    });
  });
});
