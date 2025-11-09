import { useApi, useApiMutation, ApiResponse } from "./useApi";
import { CreditCard } from "@/types";
import apiClient from "@/lib/api-client";

// API functions using centralized apiClient
const api = {
  cards: {
    getAll: async (): Promise<ApiResponse<CreditCard[]>> => {
      return await apiClient.get<CreditCard[]>("/api/cards");
    },

    getById: async (id: string): Promise<ApiResponse<CreditCard>> => {
      return await apiClient.get<CreditCard>(`/api/cards/${id}`);
    },

    create: async (
      card: Partial<CreditCard>
    ): Promise<ApiResponse<CreditCard>> => {
      return await apiClient.post<CreditCard>("/api/cards", card);
    },

    update: async ({
      id,
      ...card
    }: { id: string } & Partial<CreditCard>): Promise<
      ApiResponse<CreditCard>
    > => {
      return await apiClient.put<CreditCard>(`/api/cards/${id}`, card);
    },

    delete: async (id: string): Promise<ApiResponse<void>> => {
      return await apiClient.delete<void>(`/api/cards/${id}`);
    },
  },
};

/**
 * Hook to fetch all credit cards
 */
export function useCards() {
  return useApi(api.cards.getAll, {
    onError: (error) => {
      console.error("Failed to fetch cards:", error);
    },
  });
}

/**
 * Hook to fetch a specific credit card by ID
 */
export function useCard(id: string) {
  return useApi(() => api.cards.getById(id), {
    onError: (error) => {
      console.error(`Failed to fetch card ${id}:`, error);
    },
  });
}

/**
 * Hook to create a new credit card
 */
export function useCreateCard() {
  return useApiMutation(api.cards.create, {
    onSuccess: (data) => {
      console.log("Card created successfully:", data);
    },
    onError: (error) => {
      console.error("Failed to create card:", error);
    },
  });
}

/**
 * Hook to update a credit card
 */
export function useUpdateCard() {
  return useApiMutation(api.cards.update, {
    onSuccess: (data) => {
      console.log("Card updated successfully:", data);
    },
    onError: (error) => {
      console.error("Failed to update card:", error);
    },
  });
}

/**
 * Hook to delete a credit card
 */
export function useDeleteCard() {
  return useApiMutation(api.cards.delete, {
    onSuccess: () => {
      console.log("Card deleted successfully");
    },
    onError: (error) => {
      console.error("Failed to delete card:", error);
    },
  });
}

/**
 * Combined hook for all card operations
 */
export function useCardOperations() {
  const createCard = useCreateCard();
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();

  return {
    createCard: createCard.mutate,
    updateCard: updateCard.mutate,
    deleteCard: deleteCard.mutate,
    isCreating: createCard.loading,
    isUpdating: updateCard.loading,
    isDeleting: deleteCard.loading,
    createError: createCard.error,
    updateError: updateCard.error,
    deleteError: deleteCard.error,
  };
}
