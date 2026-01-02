import { apiGet, apiPost, apiPut, apiDelete } from "./client";
import {
  Transaction,
  TransactionFilters,
  TransactionListResponse,
  TransactionFormData,
  TransactionType
} from "../../types/transaction";

// Re-export specific types if needed by consumers of this API file
export type { Transaction, TransactionFilters, TransactionListResponse, TransactionFormData, TransactionType };

export const transactionApi = {
  /**
   * Get transactions with filters and pagination
   */
  getTransactions: async (
    filters?: TransactionFilters
  ): Promise<TransactionListResponse> => {
    const params = new URLSearchParams();

    // Map filters to query params (handling camelCase to expected API names if needed)
    // Assuming backend accepts these names or the previous implementation was correct
    if (filters?.cardId || filters?.card_id) params.append("cardId", (filters.cardId || filters.card_id)!);
    if (filters?.from) params.append("from", filters.from);
    if (filters?.to) params.append("to", filters.to);

    // Handle legacy transactionType strings vs new TransactionType enum
    if (filters?.transactionType) params.append("transactionType", filters.transactionType);
    else if (filters?.transaction_type) params.append("transactionType", filters.transaction_type);

    if (filters?.category) params.append("category", filters.category);
    if (filters?.merchant) params.append("merchant", filters.merchant);

    if (filters?.billMonth) params.append("billMonth", filters.billMonth.toString());
    if (filters?.billYear) params.append("billYear", filters.billYear.toString());

    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    if (filters?.sortBy || filters?.sort_by) params.append("sortBy", (filters.sortBy || filters.sort_by)!);
    if (filters?.sortOrder || filters?.sort_order) params.append("sortOrder", (filters.sortOrder || filters.sort_order)!);

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

  /**
   * Bulk update transactions
   */
  bulkUpdate: async (
    transactionIds: string[],
    data: Partial<TransactionFormData>
  ): Promise<{ updated: number; failed: number }> => {
    return apiPost<{ updated: number; failed: number }>(
      "/api/transactions/bulk-update",
      { transactionIds, ...data }
    ).then((res) => res);
  },

  /**
   * Bulk delete transactions
   */
  bulkDelete: async (transactionIds: string[]): Promise<{ deleted: number; failed: number }> => {
    return apiPost<{ deleted: number; failed: number }>(
      "/api/transactions/bulk-delete",
      { transactionIds }
    ).then((res) => res);
  },

  /**
   * Merge duplicate transactions
   */
  merge: async (keepTransactionId: string, duplicateTransactionId: string): Promise<void> => {
    await apiPost<void>("/api/transactions/merge", {
      keepTransactionId,
      duplicateTransactionId,
    });
  },
};
