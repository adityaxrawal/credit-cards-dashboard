import { apiGet, apiPost, apiPut, apiDelete } from "./client";

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
    return apiGet<{ data: Card[] }>("/api/cards").then((res) => res.data);
  },

  /**
   * Get a single card by ID
   */
  getCard: async (cardId: string): Promise<Card> => {
    return apiGet<{ data: Card }>(`/api/cards/${cardId}`).then(
      (res) => res.data
    );
  },

  /**
   * Get statistics for a card
   */
  getCardStatistics: async (cardId: string): Promise<CardStatistics> => {
    return apiGet<{ data: CardStatistics }>(
      `/api/cards/${cardId}/statistics`
    ).then((res) => res.data);
  },

  /**
   * Create a new card
   */
  createCard: async (data: CardFormData): Promise<Card> => {
    return apiPost<{ data: Card }>("/api/cards", data).then((res) => res.data);
  },

  /**
   * Update an existing card
   */
  updateCard: async (
    cardId: string,
    data: Partial<CardFormData>
  ): Promise<Card> => {
    return apiPut<{ data: Card }>(`/api/cards/${cardId}`, data).then(
      (res) => res.data
    );
  },

  /**
   * Delete a card
   */
  deleteCard: async (cardId: string): Promise<void> => {
    await apiDelete<void>(`/api/cards/${cardId}`);
  },
};
