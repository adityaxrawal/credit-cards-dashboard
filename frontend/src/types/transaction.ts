/**
 * Transaction Types
 * Types related to credit card transactions and transaction management
 */

import type { CreditCard } from './card';

/**
 * Transaction entity
 */
export interface Transaction {
  id: string;
  amount: number;
  transaction_date: string;
  merchant: string;
  category?: string;
  card_id: string;
  description?: string;
  bill_month: number;
  bill_year: number;
  is_settled: boolean;
  created_at: string;
  updated_at: string;
  card?: CreditCard;
}

/**
 * Filters for querying transactions
 */
export interface TransactionFilters {
  month?: number;
  year?: number;
  card_id?: string;
  category?: string;
  type?: "revenue" | "expense";
  search?: string;
  min_amount?: number;
  max_amount?: number;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

/**
 * Form data for creating/updating a transaction
 */
export interface TransactionFormData {
  amount: number;
  transaction_date: string;
  merchant: string;
  category?: string;
  card_id: string;
  description?: string;
  bill_month: number;
  bill_year: number;
}

/**
 * Request payload for creating a new transaction
 */
export interface CreateTransactionRequest {
  cardId: string;
  transactionDate: string;
  merchantName?: string;
  merchantCategory?: string;
  amount: number;
  transactionType?: "debit" | "credit" | "refund";
  description?: string;
}

/**
 * Transaction statistics
 */
export interface TransactionStats {
  total: number;
  totalAmount: number;
  thisMonthTotal: number;
  averageAmount: number;
  largestTransaction?: Transaction;
  topCategory: string;
}
