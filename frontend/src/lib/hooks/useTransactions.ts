import { useApi, useApiMutation, ApiResponse } from "./useApi";
import { Transaction } from "@/types";

export interface TransactionFilters {
  cardId?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  type?: "expense" | "revenue";
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedTransactions {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// API functions
const api = {
  transactions: {
    getAll: async (
      filters: TransactionFilters = {}
    ): Promise<ApiResponse<PaginatedTransactions>> => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });

      const response = await fetch(`/api/transactions?${params.toString()}`);
      const data = await response.json();
      return data;
    },

    getById: async (id: string): Promise<ApiResponse<Transaction>> => {
      const response = await fetch(`/api/transactions/${id}`);
      const data = await response.json();
      return data;
    },

    getByCard: async (
      cardId: string,
      filters: TransactionFilters = {}
    ): Promise<ApiResponse<PaginatedTransactions>> => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });

      const response = await fetch(
        `/api/cards/${cardId}/transactions?${params.toString()}`
      );
      const data = await response.json();
      return data;
    },

    create: async (
      transaction: Partial<Transaction>
    ): Promise<ApiResponse<Transaction>> => {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transaction),
      });
      const data = await response.json();
      return data;
    },

    update: async ({
      id,
      ...transaction
    }: { id: string } & Partial<Transaction>): Promise<
      ApiResponse<Transaction>
    > => {
      const response = await fetch(`/api/transactions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transaction),
      });
      const data = await response.json();
      return data;
    },

    delete: async (id: string): Promise<ApiResponse<void>> => {
      const response = await fetch(`/api/transactions/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      return data;
    },

    getStats: async (
      filters: TransactionFilters = {}
    ): Promise<
      ApiResponse<{
        total: number;
        totalAmount: number;
        thisMonthTotal: number;
        averageAmount: number;
        largestTransaction: Transaction;
        topCategory: string;
      }>
    > => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });

      const response = await fetch(
        `/api/transactions/stats?${params.toString()}`
      );
      const data = await response.json();
      return data;
    },
  },
};

/**
 * Hook to fetch transactions with filters
 */
export function useTransactions(filters: TransactionFilters = {}) {
  return useApi(() => api.transactions.getAll(filters), {
    onError: (error) => {
      console.error("Failed to fetch transactions:", error);
    },
  });
}

/**
 * Hook to fetch a specific transaction by ID
 */
export function useTransaction(id: string) {
  return useApi(() => api.transactions.getById(id), {
    onError: (error) => {
      console.error(`Failed to fetch transaction ${id}:`, error);
    },
  });
}

/**
 * Hook to fetch transactions for a specific card
 */
export function useCardTransactions(
  cardId: string,
  filters: TransactionFilters = {}
) {
  return useApi(() => api.transactions.getByCard(cardId, filters), {
    onError: (error) => {
      console.error(`Failed to fetch transactions for card ${cardId}:`, error);
    },
  });
}

/**
 * Hook to fetch transaction statistics
 */
export function useTransactionStats(filters: TransactionFilters = {}) {
  return useApi(() => api.transactions.getStats(filters), {
    onError: (error) => {
      console.error("Failed to fetch transaction stats:", error);
    },
  });
}

/**
 * Hook to create a new transaction
 */
export function useCreateTransaction() {
  return useApiMutation(api.transactions.create, {
    onSuccess: (data) => {
      console.log("Transaction created successfully:", data);
    },
    onError: (error) => {
      console.error("Failed to create transaction:", error);
    },
  });
}

/**
 * Hook to update a transaction
 */
export function useUpdateTransaction() {
  return useApiMutation(api.transactions.update, {
    onSuccess: (data) => {
      console.log("Transaction updated successfully:", data);
    },
    onError: (error) => {
      console.error("Failed to update transaction:", error);
    },
  });
}

/**
 * Hook to delete a transaction
 */
export function useDeleteTransaction() {
  return useApiMutation(api.transactions.delete, {
    onSuccess: () => {
      console.log("Transaction deleted successfully");
    },
    onError: (error) => {
      console.error("Failed to delete transaction:", error);
    },
  });
}

/**
 * Combined hook for all transaction operations
 */
export function useTransactionOperations() {
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  return {
    createTransaction: createTransaction.mutate,
    updateTransaction: updateTransaction.mutate,
    deleteTransaction: deleteTransaction.mutate,
    isCreating: createTransaction.loading,
    isUpdating: updateTransaction.loading,
    isDeleting: deleteTransaction.loading,
    createError: createTransaction.error,
    updateError: updateTransaction.error,
    deleteError: deleteTransaction.error,
  };
}
