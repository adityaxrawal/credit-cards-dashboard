/**
 * Budgets Module Interfaces
 */

export interface IBudgets {
  id: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  // Add specific fields based on module
}

// Use type alias instead of empty interface
export type IBudgetsResponse = IBudgets;
