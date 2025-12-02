import { apiGet, apiPost, apiPut, apiDelete } from "./client";

export interface Transaction {
  id: string;
  user_id: string;
  card_id: string;
  transaction_date: string;
  merchant: string; // Changed from merchant_name
  category: string; // Changed from merchant_category
  amount: number;
  transaction_type: "debit" | "credit" | "refund";
  bill_month: number; // Changed from billing_cycle
  bill_year: number;
  description?: string;
  is_manually_added: boolean;
  email_message_id?: string;
  created_at: string;
  updated_at: string;
  exact_timestamp?: string;
  email_subject?: string;
  gmail_message_id?: string;
  gmail_thread_id?: string;
  gmail_account_index?: number;
  currency_code?: string;
  original_amount?: number;
  reference_number?: string;
  transaction_subtype?: string;
  card?: {
    card_name: string;
    bank_name: string;
    card_number_last4: string;
    last_four?: string;
  };
}

export interface TransactionFormData {
  cardId: string;
  transactionDate: string;
  merchant: string;
  category: string;
  amount: number;
  transactionType: "debit" | "credit" | "refund";
  description?: string;
}

export interface TransactionFilters {
  cardId?: string;
  from?: string; // Changed from startDate
  to?: string;   // Changed from endDate
  transactionType?: "debit" | "credit" | "refund"; // Changed from type
  category?: string;
  merchant?: string; // New
  billMonth?: number;
  billYear?: number;
  page?: number;
  limit?: number;
}

export interface TransactionListResponse {
  data: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  aggregations?: {
    totalSpent: number;
    totalTransactions: number;
    byCategory: Record<string, number>;
  };
}

export const transactionApi = {
  /**
   * Get transactions with filters and pagination
   */
  getTransactions: async (
    filters?: TransactionFilters
  ): Promise<TransactionListResponse> => {
    const params = new URLSearchParams();

    if (filters?.cardId) params.append("cardId", filters.cardId);
    if (filters?.from) params.append("from", filters.from);
    if (filters?.to) params.append("to", filters.to);
    if (filters?.transactionType) params.append("transactionType", filters.transactionType);
    if (filters?.category) params.append("category", filters.category);
    if (filters?.merchant) params.append("merchant", filters.merchant);
    if (filters?.billMonth) params.append("billMonth", filters.billMonth.toString());
    if (filters?.billYear) params.append("billYear", filters.billYear.toString());
    
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    return apiGet<TransactionListResponse>(
      `/api/transactions?${params.toString()}`
    );
  },

  /**
   * Get a single transaction by ID
   */
  getTransaction: async (transactionId: string): Promise<Transaction> => {
    return apiGet<{ data: Transaction }>(
      `/api/transactions/${transactionId}`
    ).then((res) => res.data);
  },

  /**
   * Create a new transaction
   */
  createTransaction: async (
    data: TransactionFormData
  ): Promise<Transaction> => {
    return apiPost<{ data: Transaction }>("/api/transactions", data).then(
      (res) => res.data
    );
  },

  /**
   * Update an existing transaction
   */
  updateTransaction: async (
    transactionId: string,
    data: Partial<TransactionFormData>
  ): Promise<Transaction> => {
    return apiPut<{ data: Transaction }>(
      `/api/transactions/${transactionId}`,
      data
    ).then((res) => res.data);
  },

  /**
   * Delete a transaction
   */
  deleteTransaction: async (transactionId: string): Promise<void> => {
    await apiDelete<void>(`/api/transactions/${transactionId}`);
  },
};
