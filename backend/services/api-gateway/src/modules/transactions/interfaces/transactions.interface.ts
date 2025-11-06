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

export interface ITransactionsResponse extends ITransactions {
  // Response specific fields
}
