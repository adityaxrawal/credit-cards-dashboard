/**
 * API Client - Backward Compatibility Layer
 * 
 * This file re-exports from the unified client (core/client.ts) for backward compatibility.
 * All new code should import directly from '@/lib/api/core/client' or '@/lib/api'.
 * 
 * Part of Issue #10: Frontend API Layer Consolidation
 */

// Re-export everything from the unified client
export {
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
  makeRequest,
  ApiError,
  apiClient,
  clearCsrfToken,
  type ApiResponse,
} from './core/client';

// For backward compatibility with `import api from './client'`
export { apiClient as api } from './core/client';
export { apiClient as default } from './core/client';

// Legacy type exports for backward compatibility
export interface AuthMeResponse {
  user: {
    id: string;
    email: string;
    name: string;
    profilePicture?: string;
    gmailConnected: boolean;
    isAdmin?: boolean;
    monthlyBudget?: number;
  };
}

export interface GmailSyncResponse {
  newTransactions: number;
  duplicatesSkipped: number;
  nextRecommendedSync: string;
}

export interface BudgetStatusResponse {
  currentSpend: number;
  budgetLimit: number;
  utilization: number;
  remainingBudget: number;
  period: string;
}

export interface Card {
  id: string;
  userId: string;
  lastFour: string;
  bank: string;
  network: string;
  creditLimit?: number;
  billingCycle?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  cardId?: string;
  amount: number;
  merchant: string;
  category?: string;
  transactionDate: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
