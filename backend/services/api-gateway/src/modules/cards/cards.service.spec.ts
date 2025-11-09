import { CardService } from "./cards.service";
import { AppError } from "../../../shared/errors/AppError";

// Mock Supabase
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  order: jest.fn().mockReturnThis(),
};

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => mockSupabase),
}));

describe("CardService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAllCards", () => {
    it("should fetch all cards for a user", async () => {
      const mockCards = [
        {
          id: "1",
          user_id: "user-123",
          card_name: "Test Card",
          last_four_digits: "1234",
          credit_limit: 50000,
          is_active: true,
        },
      ];

      mockSupabase.single.mockResolvedValue({
        data: mockCards,
        error: null,
      });

      const result = await CardService.getAllCards("user-123");

      expect(mockSupabase.from).toHaveBeenCalledWith("credit_cards");
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith("user_id", "user-123");
      expect(result).toEqual(mockCards);
    });

    it("should throw AppError on database error", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      await expect(CardService.getAllCards("user-123")).rejects.toThrow(AppError);
    });
  });

  describe("getCardById", () => {
    it("should fetch a specific card by ID", async () => {
      const mockCard = {
        id: "card-1",
        user_id: "user-123",
        card_name: "Test Card",
        last_four_digits: "1234",
        credit_limit: 50000,
      };

      mockSupabase.single.mockResolvedValue({
        data: mockCard,
        error: null,
      });

      const result = await CardService.getCardById("card-1", "user-123");

      expect(mockSupabase.eq).toHaveBeenCalledWith("id", "card-1");
      expect(mockSupabase.eq).toHaveBeenCalledWith("user_id", "user-123");
      expect(result).toEqual(mockCard);
    });

    it("should throw AppError.notFound when card not found", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(CardService.getCardById("invalid-id", "user-123")).rejects.toThrow(AppError);
    });
  });

  describe("createCard", () => {
    const validCardData = {
      card_name: "New Card",
      bank_name: "Test Bank",
      last_four_digits: "5678",
      credit_limit: 100000,
      billing_date: 1,
      due_date: 20,
    };

    it("should create a new card successfully", async () => {
      const mockCreatedCard = { id: "new-card-1", ...validCardData };

      // Mock existingCards check
      mockSupabase.single.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock insert
      mockSupabase.single.mockResolvedValueOnce({
        data: mockCreatedCard,
        error: null,
      });

      const result = await CardService.createCard("user-123", validCardData);

      expect(result).toEqual(mockCreatedCard);
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it("should throw validation error for duplicate last 4 digits", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: [{ id: "existing-card" }],
        error: null,
      });

      await expect(CardService.createCard("user-123", validCardData)).rejects.toThrow(AppError);
    });

    it("should validate last 4 digits format", async () => {
      const invalidData = { ...validCardData, last_four_digits: "ABCD" };

      await expect(CardService.createCard("user-123", invalidData)).rejects.toThrow(AppError);
    });

    it("should validate billing date range", async () => {
      const invalidData = { ...validCardData, billing_date: 35 };

      await expect(CardService.createCard("user-123", invalidData)).rejects.toThrow(AppError);
    });

    it("should validate credit limit", async () => {
      const invalidData = { ...validCardData, credit_limit: -1000 };

      await expect(CardService.createCard("user-123", invalidData)).rejects.toThrow(AppError);
    });
  });

  describe("updateCard", () => {
    it("should update card successfully", async () => {
      const updateData = { card_name: "Updated Card Name" };
      const mockUpdatedCard = { id: "card-1", ...updateData };

      // Mock existing card check
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "card-1" },
        error: null,
      });

      // Mock update
      mockSupabase.single.mockResolvedValueOnce({
        data: mockUpdatedCard,
        error: null,
      });

      const result = await CardService.updateCard("card-1", "user-123", updateData);

      expect(result).toEqual(mockUpdatedCard);
      expect(mockSupabase.update).toHaveBeenCalledWith(updateData);
    });

    it("should validate before updating", async () => {
      const invalidData = { credit_limit: -5000 };

      await expect(CardService.updateCard("card-1", "user-123", invalidData)).rejects.toThrow(
        AppError
      );
    });
  });

  describe("deleteCard", () => {
    it("should soft delete a card", async () => {
      mockSupabase.single.mockResolvedValue({
        data: { id: "card-1", is_active: false },
        error: null,
      });

      await CardService.deleteCard("card-1", "user-123");

      expect(mockSupabase.update).toHaveBeenCalledWith({ is_active: false });
      expect(mockSupabase.eq).toHaveBeenCalledWith("id", "card-1");
    });

    it("should throw error on database failure", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: "Delete failed" },
      });

      await expect(CardService.deleteCard("card-1", "user-123")).rejects.toThrow(AppError);
    });
  });

  describe("getCardUsage", () => {
    it("should calculate card usage correctly", async () => {
      const mockCard = {
        id: "card-1",
        credit_limit: 100000,
        current_balance: 25000,
      };

      mockSupabase.single.mockResolvedValue({
        data: mockCard,
        error: null,
      });

      const usage = await CardService.getCardUsage("card-1", "user-123");

      expect(usage.utilized).toBe(25000);
      expect(usage.available).toBe(75000);
      expect(usage.utilizationPercent).toBe(25);
    });
  });
});
