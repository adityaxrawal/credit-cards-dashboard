import { useApi, useApiMutation, ApiResponse } from "./useApi";
import { CreditCard } from "@/types";

// API functions - these would typically be in a separate API service
const api = {
  cards: {
    getAll: async (): Promise<ApiResponse<CreditCard[]>> => {
      const response = await fetch("/api/cards");
      const data = await response.json();
      return data;
    },

    getById: async (id: string): Promise<ApiResponse<CreditCard>> => {
      const response = await fetch(`/api/cards/${id}`);
      const data = await response.json();
      return data;
    },

    create: async (
      card: Partial<CreditCard>
    ): Promise<ApiResponse<CreditCard>> => {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      });
      const data = await response.json();
      return data;
    },

    update: async ({
      id,
      ...card
    }: { id: string } & Partial<CreditCard>): Promise<
      ApiResponse<CreditCard>
    > => {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      });
      const data = await response.json();
      return data;
    },

    delete: async (id: string): Promise<ApiResponse<void>> => {
      const response = await fetch(`/api/cards/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      return data;
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
