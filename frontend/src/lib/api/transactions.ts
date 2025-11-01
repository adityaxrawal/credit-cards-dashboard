import { apiClient } from "./client";

export interface Transaction {
  id: string;
  user_id: string;
  card_id: string;
  transaction_date: string;
  merchant_name: string;
  merchant_category: string;
  amount: number;
  transaction_type: "debit" | "credit" | "refund";
  billing_cycle: string;
  description?: string;
  created_at: string;
  updated_at: string;
  card?: {
    card_name: string;
    bank_name: string;
    last_four_digits: string;
  };
}

export interface TransactionFormData {
  card_id: string;
  transaction_date: string;
  merchant_name: string;
  merchant_category: string;
  amount: number;
  transaction_type: "debit" | "credit" | "refund";
  description?: string;
}

export interface TransactionFilters {
  cardId?: string;
  startDate?: string;
  endDate?: string;
  type?: "debit" | "credit" | "refund";
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface TransactionListResponse {
  transactions: Transaction[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface TransactionStatistics {
  total_transactions: number;
  total_debit: number;
  total_credit: number;
  net_spending: number;
  average_transaction: number;
  category_breakdown: {
    category: string;
    total: number;
    count: number;
  }[];
  top_categories: {
    category: string;
    total: number;
  }[];
}

export const transactionApi = {
  /**
   * Get transactions with filters and pagination
   */
  getTransactions: async (
    filters?: TransactionFilters,
    pagination?: PaginationOptions
  ): Promise<TransactionListResponse> => {
    const params = new URLSearchParams();

    if (filters?.cardId) params.append("cardId", filters.cardId);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.type) params.append("type", filters.type);
    if (filters?.category) params.append("category", filters.category);
    if (filters?.minAmount)
      params.append("minAmount", filters.minAmount.toString());
    if (filters?.maxAmount)
      params.append("maxAmount", filters.maxAmount.toString());
    if (filters?.search) params.append("search", filters.search);

    if (pagination?.page) params.append("page", pagination.page.toString());
    if (pagination?.limit) params.append("limit", pagination.limit.toString());
    if (pagination?.sortBy) params.append("sortBy", pagination.sortBy);
    if (pagination?.sortOrder) params.append("sortOrder", pagination.sortOrder);

    const response = await apiClient.get(`/transactions?${params.toString()}`);
    return response.data.data;
  },

  /**
   * Get a single transaction by ID
   */
  getTransaction: async (transactionId: string): Promise<Transaction> => {
    const response = await apiClient.get(`/transactions/${transactionId}`);
    return response.data.data;
  },

  /**
   * Get recent transactions
   */
  getRecentTransactions: async (limit: number = 10): Promise<Transaction[]> => {
    const response = await apiClient.get(`/transactions/recent?limit=${limit}`);
    return response.data.data;
  },

  /**
   * Get transaction statistics
   */
  getStatistics: async (
    filters?: TransactionFilters
  ): Promise<TransactionStatistics> => {
    const params = new URLSearchParams();

    if (filters?.cardId) params.append("cardId", filters.cardId);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);

    const response = await apiClient.get(
      `/transactions/statistics?${params.toString()}`
    );
    return response.data.data;
  },

  /**
   * Create a new transaction
   */
  createTransaction: async (
    data: TransactionFormData
  ): Promise<Transaction> => {
    const response = await apiClient.post("/transactions", data);
    return response.data.data;
  },

  /**
   * Update an existing transaction
   */
  updateTransaction: async (
    transactionId: string,
    data: Partial<TransactionFormData>
  ): Promise<Transaction> => {
    const response = await apiClient.put(
      `/transactions/${transactionId}`,
      data
    );
    return response.data.data;
  },

  /**
   * Delete a transaction
   */
  deleteTransaction: async (transactionId: string): Promise<void> => {
    await apiClient.delete(`/transactions/${transactionId}`);
  },
};
