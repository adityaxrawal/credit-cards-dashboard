/**
 * Transaction Management Service
 * API endpoints for transaction CRUD operations
 */

import { apiGet, apiPost, apiPut, apiDelete } from '../core/client';
import type {
  Transaction,
  TransactionFilters,
  TransactionFormData,
  CreateTransactionRequest,
} from '@/types/transaction';
import type { PaginatedResponse } from '@/types/common';

/**
 * Transaction list response with pagination and aggregations
 */
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

/**
 * Transaction API service
 */
export const transactionService = {
  /**
   * Get transactions with filters and pagination
   */
  getAll: async (
    filters?: TransactionFilters
  ): Promise<TransactionListResponse> => {
    const params = new URLSearchParams();

    if (filters?.card_id) params.append("cardId", filters.card_id);
    if (filters?.start_date) params.append("from", filters.start_date);
    if (filters?.end_date) params.append("to", filters.end_date);
    if (filters?.type) params.append("transactionType", filters.type);
    if (filters?.category) params.append("category", filters.category);
    if (filters?.search) params.append("merchant", filters.search);
    if (filters?.month) params.append("billMonth", filters.month.toString());
    if (filters?.year) params.append("billYear", filters.year.toString());

    const page = 1; // Default page
    const limit = filters?.limit || 50;
    params.append("page", page.toString());
    params.append("limit", limit.toString());

    return apiGet<TransactionListResponse>(
      `/api/transactions?${params.toString()}`
    );
  },

  /**
   * Get a single transaction by ID
   */
  getById: async (transactionId: string): Promise<Transaction> => {
    return apiGet<{ data: Transaction }>(
      `/api/transactions/${transactionId}`
    ).then((res) => res.data);
  },

  /**
   * Create a new transaction
   */
  create: async (
    data: CreateTransactionRequest
  ): Promise<Transaction> => {
    return apiPost<{ data: Transaction }>("/api/transactions", data).then(
      (res) => res.data
    );
  },

  /**
   * Update an existing transaction
   */
  update: async (
    transactionId: string,
    data: Partial<CreateTransactionRequest>
  ): Promise<Transaction> => {
    return apiPut<{ data: Transaction }>(
      `/api/transactions/${transactionId}`,
      data
    ).then((res) => res.data);
  },

  /**
   * Delete a transaction
   */
  delete: async (transactionId: string): Promise<void> => {
    await apiDelete<void>(`/api/transactions/${transactionId}`);
  },
};

// Legacy export for backward compatibility
export const transactionApi = transactionService;
