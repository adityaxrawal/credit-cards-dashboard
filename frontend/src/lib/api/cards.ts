import { apiClient } from "./client";

export interface Card {
  id: string;
  user_id: string;
  card_name: string;
  bank_name: string;
  card_type: "credit" | "debit";
  last_four_digits: string;
  credit_limit: number;
  current_outstanding: number;
  bill_date: number;
  due_date: number;
  created_at: string;
  updated_at: string;
}

export interface CardFormData {
  card_name: string;
  bank_name: string;
  card_type: "credit" | "debit";
  last_four_digits: string;
  credit_limit: number;
  bill_date: number;
  due_date: number;
}

export interface CardStatistics {
  total_transactions: number;
  total_spent: number;
  current_month_spent: number;
  average_transaction: number;
  category_breakdown: {
    category: string;
    total: number;
  }[];
}

export const cardApi = {
  /**
   * Get all cards for the authenticated user
   */
  getCards: async (): Promise<Card[]> => {
    const response = await apiClient.get("/cards");
    return response.data.data;
  },

  /**
   * Get a single card by ID
   */
  getCard: async (cardId: string): Promise<Card> => {
    const response = await apiClient.get(`/cards/${cardId}`);
    return response.data.data;
  },

  /**
   * Get statistics for a card
   */
  getCardStatistics: async (cardId: string): Promise<CardStatistics> => {
    const response = await apiClient.get(`/cards/${cardId}/statistics`);
    return response.data.data;
  },

  /**
   * Create a new card
   */
  createCard: async (data: CardFormData): Promise<Card> => {
    const response = await apiClient.post("/cards", data);
    return response.data.data;
  },

  /**
   * Update an existing card
   */
  updateCard: async (
    cardId: string,
    data: Partial<CardFormData>
  ): Promise<Card> => {
    const response = await apiClient.put(`/cards/${cardId}`, data);
    return response.data.data;
  },

  /**
   * Delete a card
   */
  deleteCard: async (cardId: string): Promise<void> => {
    await apiClient.delete(`/cards/${cardId}`);
  },
};
