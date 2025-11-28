import { apiGet, apiPost, apiPut, apiDelete } from "./client";

export interface Card {
  id: string;
  user_id: string;
  card_name: string;
  bank_name: string;
  card_number_last4: string; // Changed from last_four_digits
  credit_limit: number;
  current_balance: number; // Changed from current_outstanding
  bill_date: number;
  due_date: number;
  activation_date?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Computed fields from backend
  utilization?: number;
  nextBillDate?: string;
  nextDueDate?: string;
}

export interface CardFormData {
  cardName: string; // Changed to camelCase to match backend controller expectation if needed, or keep snake_case if backend handles it. 
  // Checking backend controller: it expects camelCase in req.body (cardName, bankName, etc.)
  bankName: string;
  lastFour: string;
  billDate: number;
  dueDate: number;
  creditLimit: number;
  activationDate?: string;
  notes?: string;
}

export interface CardStatement {
  card: Card;
  billingPeriod: {
    start: string;
    end: string;
    dueDate: string;
  };
  transactions: any[]; // We can type this properly later
  summary: {
    totalDebits: number;
    totalCredits: number;
    netAmount: number;
    transactionCount: number;
  };
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
   * Get card statement for a specific month/year
   */
  getCardStatement: async (
    cardId: string, 
    month: number, 
    year: number
  ): Promise<CardStatement> => {
    return apiGet<{ data: CardStatement }>(
      `/api/cards/${cardId}/statements?month=${month}&year=${year}`
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
