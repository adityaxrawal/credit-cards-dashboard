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

export interface IBudgetsResponse extends IBudgets {
  // Response specific fields
}
