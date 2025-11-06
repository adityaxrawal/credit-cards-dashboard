import { supabase } from "shared/database/supabase";

/**
 * Card interface matching database schema
 */
export interface Card {
  id: string;
  user_id: string;
  card_name: string;
  last_four_digits: string;
  card_type: string;
  bank_name: string;
  credit_limit: number;
  billing_date: number;
  due_date: number;
  card_network: string;
  reward_rate?: number;
  annual_fee?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * CardService handles all card-related operations
 */
export class CardService {
  /**
   * Get all cards for a user
   * @param userId - User ID
   * @param includeInactive - Whether to include inactive cards
   */
  async getUserCards(userId: string, includeInactive = false) {
    try {
      let query = supabase
        .from("credit_cards")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!includeInactive) {
        query = query.eq("is_active", true);
      }

      const { data: cards, error } = await query;

      if (error) {
        console.error("Get cards error:", error);
        throw new Error("Failed to fetch cards");
      }

      return cards || [];
    } catch (error: any) {
      throw new Error(`Failed to fetch cards: ${error.message}`);
    }
  }

  /**
   * Get a single card by ID
   * @param cardId - Card ID
   * @param userId - User ID (for authorization)
   */
  async getCardById(cardId: string, userId: string) {
    try {
      const { data: card, error } = await supabase
        .from("credit_cards")
        .select("*")
        .eq("id", cardId)
        .eq("user_id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error("Card not found");
        }
        throw new Error("Failed to fetch card");
      }

      return card;
    } catch (error: any) {
      throw new Error(`Failed to fetch card: ${error.message}`);
    }
  }

  /**
   * Create a new card
   * @param userId - User ID
   * @param cardData - Card data
   */
  async createCard(userId: string, cardData: Partial<Card>) {
    try {
      // Validate required fields
      this.validateCardData(cardData);

      // Check if user already has a card with same last 4 digits
      const { data: existingCards } = await supabase
        .from("credit_cards")
        .select("id")
        .eq("user_id", userId)
        .eq("last_four_digits", cardData.last_four_digits)
        .eq("is_active", true);

      if (existingCards && existingCards.length > 0) {
        throw new Error("A card with these last 4 digits already exists");
      }

      const { data: card, error } = await supabase
        .from("credit_cards")
        .insert({
          user_id: userId,
          card_name: cardData.card_name,
          last_four_digits: cardData.last_four_digits,
          card_type: cardData.card_type || "CREDIT",
          bank_name: cardData.bank_name,
          credit_limit: cardData.credit_limit,
          billing_date: cardData.billing_date,
          due_date: cardData.due_date,
          card_network: cardData.card_network || "VISA",
          reward_rate: cardData.reward_rate || 0,
          annual_fee: cardData.annual_fee || 0,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error("Create card error:", error);
        throw new Error("Failed to create card");
      }

      return card;
    } catch (error: any) {
      throw new Error(`Failed to create card: ${error.message}`);
    }
  }

  /**
   * Update an existing card
   * @param cardId - Card ID
   * @param userId - User ID (for authorization)
   * @param cardData - Updated card data
   */
  async updateCard(cardId: string, userId: string, cardData: Partial<Card>) {
    try {
      // Verify card belongs to user
      await this.getCardById(cardId, userId);

      const { data: card, error } = await supabase
        .from("credit_cards")
        .update({
          card_name: cardData.card_name,
          last_four_digits: cardData.last_four_digits,
          card_type: cardData.card_type,
          bank_name: cardData.bank_name,
          credit_limit: cardData.credit_limit,
          billing_date: cardData.billing_date,
          due_date: cardData.due_date,
          card_network: cardData.card_network,
          reward_rate: cardData.reward_rate,
          annual_fee: cardData.annual_fee,
          is_active: cardData.is_active,
        })
        .eq("id", cardId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        console.error("Update card error:", error);
        throw new Error("Failed to update card");
      }

      return card;
    } catch (error: any) {
      throw new Error(`Failed to update card: ${error.message}`);
    }
  }

  /**
   * Delete a card (soft delete by setting is_active to false)
   * @param cardId - Card ID
   * @param userId - User ID (for authorization)
   */
  async deleteCard(cardId: string, userId: string) {
    try {
      // Verify card belongs to user
      await this.getCardById(cardId, userId);

      const { error } = await supabase
        .from("credit_cards")
        .update({ is_active: false })
        .eq("id", cardId)
        .eq("user_id", userId);

      if (error) {
        console.error("Delete card error:", error);
        throw new Error("Failed to delete card");
      }

      return { success: true };
    } catch (error: any) {
      throw new Error(`Failed to delete card: ${error.message}`);
    }
  }

  /**
   * Get card statistics
   * @param cardId - Card ID
   * @param userId - User ID (for authorization)
   */
  async getCardStatistics(cardId: string, userId: string) {
    try {
      // Verify card belongs to user
      const card = await this.getCardById(cardId, userId);

      // Get current month's transactions
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("amount, transaction_type")
        .eq("card_id", cardId)
        .gte("transaction_date", startOfMonth.toISOString());

      if (error) {
        throw new Error("Failed to fetch transactions");
      }

      const totalSpent =
        transactions
          ?.filter((t) => t.transaction_type === "DEBIT")
          .reduce((sum, t) => sum + t.amount, 0) || 0;

      const totalCredit =
        transactions
          ?.filter((t) => t.transaction_type === "CREDIT")
          .reduce((sum, t) => sum + t.amount, 0) || 0;

      const utilizationPercent = card.credit_limit
        ? (totalSpent / card.credit_limit) * 100
        : 0;

      return {
        card_id: cardId,
        total_spent: totalSpent,
        total_credit: totalCredit,
        available_credit: card.credit_limit - totalSpent + totalCredit,
        utilization_percent: Math.round(utilizationPercent * 100) / 100,
        transaction_count: transactions?.length || 0,
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch card statistics: ${error.message}`);
    }
  }

  /**
   * Validate card data
   * @param cardData - Card data to validate
   */
  private validateCardData(cardData: Partial<Card>) {
    const required = [
      "card_name",
      "last_four_digits",
      "bank_name",
      "credit_limit",
      "billing_date",
      "due_date",
    ];

    for (const field of required) {
      if (!(field in cardData) || cardData[field as keyof Card] === undefined) {
        throw new Error(`${field} is required`);
      }
    }

    // Validate last 4 digits
    if (
      cardData.last_four_digits &&
      !/^\d{4}$/.test(cardData.last_four_digits)
    ) {
      throw new Error("Last 4 digits must be exactly 4 digits");
    }

    // Validate billing and due dates (1-31)
    if (
      cardData.billing_date &&
      (cardData.billing_date < 1 || cardData.billing_date > 31)
    ) {
      throw new Error("Billing date must be between 1 and 31");
    }

    if (
      cardData.due_date &&
      (cardData.due_date < 1 || cardData.due_date > 31)
    ) {
      throw new Error("Due date must be between 1 and 31");
    }

    // Validate credit limit
    if (cardData.credit_limit && cardData.credit_limit <= 0) {
      throw new Error("Credit limit must be greater than 0");
    }
  }
}


// Export singleton instance
export const cardService = new CardService();
