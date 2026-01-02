import { apiGet, apiPost } from "@/shared/api/client";

export interface RewardPoints {
  id: string;
  card_id: string;
  card_name?: string;
  bank_name?: string;
  card_number_last4?: string;
  points_earned: number;
  points_redeemed: number;
  points_balance: number;
  points_expiring_soon: number;
  next_expiry_date?: string;
  last_updated: string;
  created_at: string;
}

export interface RewardTransaction {
  id: string;
  card_id: string;
  transaction_id?: string;
  points_change: number;
  description?: string;
  expiry_date?: string;
  merchant?: string;
  transaction_amount?: number;
  transaction_date?: string;
  created_at: string;
}

export interface RewardsSummary {
  summary: {
    total_points_earned: number;
    total_points_redeemed: number;
    total_points_balance: number;
    total_points_expiring_soon: number;
    cards_with_rewards: number;
  };
  byCard: RewardPoints[];
}

export interface RewardPointsFormData {
  cardId: string;
  pointsEarned: number;
  pointsRedeemed: number;
  pointsBalance: number;
  pointsExpiringSoon?: number;
  nextExpiryDate?: string;
}

export interface RewardTransactionFormData {
  cardId: string;
  transactionId?: string;
  pointsChange: number;
  description?: string;
  expiryDate?: string;
}

export const rewardsApi = {
  /**
   * Get all rewards
   */
  getAll: async (): Promise<RewardPoints[]> => {
    return apiGet<{ data: RewardPoints[] }>("/api/rewards").then((res) => res.data);
  },

  /**
   * Get rewards summary
   */
  getSummary: async (): Promise<RewardsSummary> => {
    return apiGet<{ data: RewardsSummary }>("/api/rewards/summary").then((res) => res.data);
  },

  /**
   * Get rewards for a specific card
   */
  getCardRewards: async (cardId: string): Promise<{ rewards: RewardPoints; transactions: RewardTransaction[] }> => {
    return apiGet<{ 
      data: { 
        rewards: RewardPoints; 
        transactions: RewardTransaction[] 
      } 
    }>(`/api/rewards/${cardId}`).then((res) => res.data);
  },

  /**
   * Get reward transactions for a card
   */
  getCardTransactions: async (cardId: string): Promise<RewardTransaction[]> => {
    return apiGet<{ data: RewardTransaction[] }>(`/api/rewards/${cardId}/transactions`).then((res) => res.data);
  },

  /**
   * Update reward points for a card
   */
  upsertPoints: async (data: RewardPointsFormData): Promise<RewardPoints> => {
    return apiPost<{ data: RewardPoints }>("/api/rewards", data).then((res) => res.data);
  },

  /**
   * Create a reward transaction
   */
  createTransaction: async (data: RewardTransactionFormData): Promise<RewardTransaction> => {
    return apiPost<{ data: RewardTransaction }>("/api/rewards/transactions", data).then((res) => res.data);
  },
};

