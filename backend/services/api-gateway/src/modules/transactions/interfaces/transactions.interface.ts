/**
 * Transactions Module Interfaces
 */

export interface ITransactions {
  id: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  // Add specific fields based on module
}

// Use type alias instead of empty interface
export type ITransactionsResponse = ITransactions;
