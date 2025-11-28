/**
 * Card Management Service
 * API endpoints for credit card CRUD operations
 */

import { apiGet, apiPost, apiPut, apiDelete } from '../core/client';
import type { CreditCard, CardFormData, CreateCardRequest } from '@/types/card';

/**
 * Card statement response
 */
export interface CardStatement {
  card: CreditCard;
  billingPeriod: {
    start: string;
    end: string;
    dueDate: string;
  };
  transactions: any[]; // Use Transaction type when cross-importing
  summary: {
    totalDebits: number;
    totalCredits: number;
    netAmount: number;
    transactionCount: number;
  };
}

/**
 * Card API service
 */
export const cardService = {
  /**
   * Get all cards for the authenticated user
   */
  getAll: async (): Promise<CreditCard[]> => {
    return apiGet<{ data: CreditCard[] }>("/api/cards").then((res) => res.data);
  },

  /**
   * Get a single card by ID
   */
  getById: async (cardId: string): Promise<CreditCard> => {
    return apiGet<{ data: CreditCard }>(`/api/cards/${cardId}`).then(
      (res) => res.data
    );
  },

  /**
   * Get card statement for a specific month/year
   */
  getStatement: async (
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
  create: async (data: CreateCardRequest): Promise<CreditCard> => {
    return apiPost<{ data: CreditCard }>("/api/cards", data).then(
      (res) => res.data
    );
  },

  /**
   * Update an existing card
   */
  update: async (
    cardId: string,
    data: Partial<CreateCardRequest>
  ): Promise<CreditCard> => {
    return apiPut<{ data: CreditCard }>(`/api/cards/${cardId}`, data).then(
      (res) => res.data
    );
  },

  /**
   * Delete a card
   */
  delete: async (cardId: string): Promise<void> => {
    await apiDelete<void>(`/api/cards/${cardId}`);
  },
};

// Legacy export for backward compatibility
export const cardApi = cardService;
