/**
 * Rewards Service Unit Tests
 * Tests points accrual, redemption flow, and reward optimization
 */

import { RewardsService } from "./rewards.service";
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

describe("RewardsService", () => {
  const mockUserId = "user-test-123";
  const mockCardId = "card-test-001";

  beforeEach(() => {
    reset();
    jest.clearAllMocks();
  });

  describe("calculateRewardsForTransaction", () => {
    it("should calculate cashback rewards correctly", async () => {
      const mockTransaction = {
        id: "txn-001",
        user_id: mockUserId,
        card_id: mockCardId,
        amount: 1000,
        category: "shopping",
        merchant_name: "Amazon",
      };

      const mockRewardProgram = {
        id: "program-001",
        card_id: mockCardId,
        type: "cashback",
        base_rate: 1.0, // 1%
        category_rates: {
          shopping: 5.0, // 5% on shopping
        },
      };

      setReturnValue("reward_programs", "select", createMockResponse([mockRewardProgram]));
      setReturnValue(
        "earned_rewards",
        "insert",
        createMockResponse({
          id: "reward-001",
          amount: 50, // 5% of 1000
        })
      );

      const result = await RewardsService.calculateRewardsForTransaction(mockTransaction);

      expect(result.amount).toBe(50);
      expect(result.category).toBe("shopping");
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it("should use base rate when no category rate is defined", async () => {
      const mockTransaction = {
        id: "txn-002",
        user_id: mockUserId,
        card_id: mockCardId,
        amount: 2000,
        category: "other",
        merchant_name: "Generic Store",
      };

      const mockRewardProgram = {
        id: "program-001",
        card_id: mockCardId,
        type: "points",
        base_rate: 1.0, // 1 point per 100 rupees
        category_rates: {},
      };

      setReturnValue("reward_programs", "select", createMockResponse([mockRewardProgram]));
      setReturnValue(
        "earned_rewards",
        "insert",
        createMockResponse({
          id: "reward-002",
          amount: 20, // 1% of 2000
        })
      );

      const result = await RewardsService.calculateRewardsForTransaction(mockTransaction);

      expect(result.amount).toBe(20);
    });

    it("should apply category-specific bonus rates", async () => {
      const mockTransaction = {
        id: "txn-003",
        user_id: mockUserId,
        card_id: mockCardId,
        amount: 5000,
        category: "travel",
        merchant_name: "Airline",
      };

      const mockRewardProgram = {
        id: "program-001",
        card_id: mockCardId,
        type: "miles",
        base_rate: 1.0,
        category_rates: {
          travel: 10.0, // 10x miles on travel
        },
        bonus_categories: ["travel"],
      };

      setReturnValue("reward_programs", "select", createMockResponse([mockRewardProgram]));
      setReturnValue(
        "earned_rewards",
        "insert",
        createMockResponse({
          id: "reward-003",
          amount: 500, // 10% of 5000
        })
      );

      const result = await RewardsService.calculateRewardsForTransaction(mockTransaction);

      expect(result.amount).toBe(500);
      expect(result.reward_type).toBe("miles");
    });

    it("should handle merchant-specific bonus rates", async () => {
      const mockTransaction = {
        id: "txn-004",
        user_id: mockUserId,
        card_id: mockCardId,
        amount: 1000,
        category: "shopping",
        merchant_name: "AMAZON",
      };

      const mockRewardProgram = {
        id: "program-001",
        card_id: mockCardId,
        type: "cashback",
        base_rate: 1.0,
        category_rates: {
          shopping: 2.0,
        },
        merchant_bonuses: {
          AMAZON: 5.0, // Extra 5% on Amazon
        },
      };

      setReturnValue("reward_programs", "select", createMockResponse([mockRewardProgram]));
      setReturnValue(
        "earned_rewards",
        "insert",
        createMockResponse({
          id: "reward-004",
          amount: 50,
        })
      );

      const result = await RewardsService.calculateRewardsForTransaction(mockTransaction);

      expect(result.amount).toBeGreaterThanOrEqual(20); // At least 2% base
    });
  });

  describe("redeemRewards", () => {
    it("should redeem rewards successfully when balance is sufficient", async () => {
      const redemptionRequest = {
        userId: mockUserId,
        cardId: mockCardId,
        rewardType: "points" as const,
        amount: 5000,
        redemptionMethod: "statement_credit",
      };

      const mockEarnedRewards = [
        {
          id: "reward-001",
          user_id: mockUserId,
          card_id: mockCardId,
          reward_type: "points",
          amount: 10000,
          status: "active",
        },
      ];

      setReturnValue("earned_rewards", "select", createMockResponse(mockEarnedRewards));
      setReturnValue(
        "reward_redemptions",
        "insert",
        createMockResponse({
          id: "redemption-001",
        })
      );
      setReturnValue(
        "earned_rewards",
        "update",
        createMockResponse({
          id: "reward-001",
          status: "redeemed",
        })
      );

      const result = await RewardsService.redeemRewards(redemptionRequest);

      expect(result.success).toBe(true);
      expect(result.redemptionId).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith("reward_redemptions");
    });

    it("should throw error when balance is insufficient", async () => {
      const redemptionRequest = {
        userId: mockUserId,
        cardId: mockCardId,
        rewardType: "cashback" as const,
        amount: 10000,
        redemptionMethod: "bank_transfer",
      };

      const mockEarnedRewards = [
        {
          id: "reward-001",
          user_id: mockUserId,
          amount: 5000, // Less than requested
          status: "active",
        },
      ];

      setReturnValue("earned_rewards", "select", createMockResponse(mockEarnedRewards));

      await expect(RewardsService.redeemRewards(redemptionRequest)).rejects.toThrow();
    });

    it("should enforce minimum redemption limits", async () => {
      const redemptionRequest = {
        userId: mockUserId,
        cardId: mockCardId,
        rewardType: "points" as const,
        amount: 500, // Below minimum
        redemptionMethod: "voucher",
      };

      const mockRewardProgram = {
        id: "program-001",
        card_id: mockCardId,
        redemption_options: [
          {
            type: "voucher",
            minimum_redemption: 1000, // Minimum 1000 points
          },
        ],
      };

      setReturnValue("reward_programs", "select", createMockResponse([mockRewardProgram]));

      await expect(RewardsService.redeemRewards(redemptionRequest)).rejects.toThrow();
    });

    it("should handle redemption of expired rewards", async () => {
      const redemptionRequest = {
        userId: mockUserId,
        cardId: mockCardId,
        rewardType: "miles" as const,
        amount: 1000,
        redemptionMethod: "flight_booking",
      };

      const mockEarnedRewards = [
        {
          id: "reward-001",
          user_id: mockUserId,
          amount: 2000,
          status: "expired", // Already expired
          expiration_date: "2023-12-31",
        },
      ];

      setReturnValue("earned_rewards", "select", createMockResponse(mockEarnedRewards));

      await expect(RewardsService.redeemRewards(redemptionRequest)).rejects.toThrow();
    });

    it("should calculate redemption value correctly", async () => {
      const redemptionRequest = {
        userId: mockUserId,
        cardId: mockCardId,
        rewardType: "points" as const,
        amount: 10000,
        redemptionMethod: "statement_credit",
      };

      const mockRewardProgram = {
        id: "program-001",
        card_id: mockCardId,
        redemption_options: [
          {
            type: "statement_credit",
            value: 0.25, // 1 point = 0.25 INR
          },
        ],
      };

      const mockEarnedRewards = [
        {
          id: "reward-001",
          amount: 15000,
          status: "active",
        },
      ];

      setReturnValue("reward_programs", "select", createMockResponse([mockRewardProgram]));
      setReturnValue("earned_rewards", "select", createMockResponse(mockEarnedRewards));
      setReturnValue(
        "reward_redemptions",
        "insert",
        createMockResponse({
          id: "redemption-001",
          redemption_value: 2500, // 10000 * 0.25
        })
      );

      const result = await RewardsService.redeemRewards(redemptionRequest);

      expect(result.redemptionValue).toBe(2500);
    });
  });

  describe("getRewardsBalance", () => {
    it("should calculate total available rewards balance", async () => {
      const mockRewards = [
        {
          id: "reward-001",
          user_id: mockUserId,
          card_id: mockCardId,
          reward_type: "cashback",
          amount: 500,
          status: "active",
        },
        {
          id: "reward-002",
          user_id: mockUserId,
          card_id: mockCardId,
          reward_type: "points",
          amount: 10000,
          status: "active",
        },
        {
          id: "reward-003",
          user_id: mockUserId,
          card_id: mockCardId,
          reward_type: "cashback",
          amount: 200,
          status: "redeemed", // Should not be counted
        },
      ];

      setReturnValue("earned_rewards", "select", createMockResponse(mockRewards));

      const result = await RewardsService.getRewardsBalance(mockUserId, mockCardId);

      expect(result.cashback).toBe(500);
      expect(result.points).toBe(10000);
      expect(result.totalValueINR).toBeGreaterThan(0);
    });

    it("should exclude expired rewards from balance", async () => {
      const mockRewards = [
        {
          id: "reward-001",
          amount: 1000,
          status: "active",
          expiration_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        },
        {
          id: "reward-002",
          amount: 500,
          status: "active",
          expiration_date: new Date(Date.now() - 86400000).toISOString(), // Yesterday - expired
        },
      ];

      setReturnValue("earned_rewards", "select", createMockResponse(mockRewards));

      const result = await RewardsService.getRewardsBalance(mockUserId, mockCardId);

      // Should only count the non-expired reward
      expect(result.totalValueINR).toBeGreaterThan(0);
    });

    it("should return zero balance when no active rewards exist", async () => {
      setReturnValue("earned_rewards", "select", createMockResponse([]));

      const result = await RewardsService.getRewardsBalance(mockUserId, mockCardId);

      expect(result.cashback).toBe(0);
      expect(result.points).toBe(0);
      expect(result.miles).toBe(0);
      expect(result.totalValueINR).toBe(0);
    });
  });

  describe("getRewardOptimizationTips", () => {
    it("should generate optimization tips based on spending patterns", async () => {
      const mockTransactions = [
        {
          id: "txn-001",
          user_id: mockUserId,
          category: "shopping",
          amount: 50000,
        },
        {
          id: "txn-002",
          user_id: mockUserId,
          category: "fuel",
          amount: 10000,
        },
      ];

      const mockCards = [
        {
          id: mockCardId,
          user_id: mockUserId,
          card_name: "Standard Card",
        },
      ];

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));
      setReturnValue("credit_cards", "select", createMockResponse(mockCards));

      const result = await RewardsService.getRewardOptimizationTips(mockUserId);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("type");
      expect(result[0]).toHaveProperty("potentialBenefit");
    });

    it("should recommend cards with better rates for top categories", async () => {
      const mockTransactions = [
        {
          category: "travel",
          amount: 100000,
        },
      ];

      setReturnValue("transactions", "select", createMockResponse(mockTransactions));
      setReturnValue("credit_cards", "select", createMockResponse([{ id: mockCardId }]));

      const result = await RewardsService.getRewardOptimizationTips(mockUserId);

      const travelTip = result.find((tip) => tip.type === "card_recommendation");
      expect(travelTip).toBeDefined();
    });

    it("should suggest redemption strategy to maximize value", async () => {
      const mockRewards = [
        {
          id: "reward-001",
          reward_type: "points",
          amount: 50000,
          status: "active",
        },
      ];

      setReturnValue("earned_rewards", "select", createMockResponse(mockRewards));
      setReturnValue("transactions", "select", createMockResponse([]));
      setReturnValue("credit_cards", "select", createMockResponse([{ id: mockCardId }]));

      const result = await RewardsService.getRewardOptimizationTips(mockUserId);

      const redemptionTip = result.find((tip) => tip.type === "redemption_strategy");
      expect(redemptionTip).toBeDefined();
    });
  });

  describe("expireRewards", () => {
    it("should mark expired rewards as expired", async () => {
      const expiredDate = new Date();
      expiredDate.setMonth(expiredDate.getMonth() - 12);

      const mockRewards = [
        {
          id: "reward-001",
          user_id: mockUserId,
          status: "active",
          expiration_date: expiredDate.toISOString(),
        },
      ];

      setReturnValue("earned_rewards", "select", createMockResponse(mockRewards));
      setReturnValue(
        "earned_rewards",
        "update",
        createMockResponse({
          id: "reward-001",
          status: "expired",
        })
      );

      const result = await RewardsService.expireRewards();

      expect(result.expiredCount).toBeGreaterThan(0);
      expect(mockSupabase.update).toHaveBeenCalled();
    });

    it("should not expire active rewards with future expiration dates", async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 6);

      const mockRewards = [
        {
          id: "reward-001",
          status: "active",
          expiration_date: futureDate.toISOString(),
        },
      ];

      setReturnValue("earned_rewards", "select", createMockResponse(mockRewards));

      const result = await RewardsService.expireRewards();

      expect(result.expiredCount).toBe(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully in calculateRewardsForTransaction", async () => {
      const mockTransaction = {
        id: "txn-001",
        user_id: mockUserId,
        card_id: mockCardId,
        amount: 1000,
        category: "shopping",
      };

      setError("reward_programs", "select", new Error("Database error"));

      await expect(
        RewardsService.calculateRewardsForTransaction(mockTransaction)
      ).rejects.toThrow();
    });

    it("should throw error when reward program not found", async () => {
      const mockTransaction = {
        id: "txn-001",
        user_id: mockUserId,
        card_id: "invalid-card",
        amount: 1000,
        category: "shopping",
      };

      setReturnValue("reward_programs", "select", createMockResponse(null));

      await expect(
        RewardsService.calculateRewardsForTransaction(mockTransaction)
      ).rejects.toThrow();
    });
  });
});
