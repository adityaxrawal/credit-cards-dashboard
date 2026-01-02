/**
 * Transaction Types
 * Types related to credit card transactions and transaction management
 */

import type { CreditCard } from './card';

// ============================================
// Enums
// ============================================

export type TransactionStatus = 'pending' | 'posted' | 'reversed' | 'failed' | 'hold';

export type TransactionChannel =
  | 'atm'
  | 'pos'
  | 'ecommerce'
  | 'upi'
  | 'netbanking'
  | 'neft'
  | 'rtgs'
  | 'imps'
  | 'wire'
  | 'internal'
  | 'cheque';

export type TransactionLinkType =
  | 'refund'
  | 'settlement'
  | 'partial_refund'
  | 'split'
  | 'authorization'
  | 'reversal';

export type TransactionType =
  | 'cc_spend'
  | 'cc_upi'
  | 'cc_payment'
  | 'cc_reversal'
  | 'bank_debit'
  | 'bank_upi_debit'
  | 'bank_credit'
  | 'bank_upi_credit'
  | 'salary'
  | 'refund'
  | 'chargeback'
  | 'statement_txn'
  | 'investment'
  | 'fee'
  | 'bank_charge'
  | 'interest_debit'
  | 'interest_credit'
  | 'cheque_deposit'
  | 'cheque_return'
  | 'atm_inquiry'
  | 'atm_withdrawal'
  | 'sweep_in'
  | 'sweep_out'
  | 'standing_instruction'
  | 'enach'
  | 'cash_deposit'
  | 'wallet_load'
  | 'wallet_unload'
  | 'card_limit_change'
  | 'pre_authorization'
  | 'loan_disbursal'
  | 'loan_repayment'
  | 'emi_creation'
  | 'emi_installment'
  | 'unclassified'
  // Legacy
  | 'bill_payment'
  | 'debit'
  | 'credit';

// ============================================
// Transaction Entity
// ============================================

export interface TransactionMetadata {
  [key: string]: unknown;
  original_merchant?: string;
  payment_mode?: string;
  bank_ref_num?: string;
  tax_amount?: number;
  location?: string;
  is_recurring?: boolean;
  installments?: {
    current: number;
    total: number;
  };
  related_message_ids?: string[];
}

/**
 * Transaction entity - Aligned with Backend
 */
export interface Transaction {
  id: string;
  user_id: string;
  card_id: string;
  transaction_date: string; // ISO String from Date
  merchant: string;
  category: string;
  amount: number;
  transaction_type: TransactionType;
  description: string | null;
  bill_month: number | null;
  bill_year: number | null;
  is_settled: boolean;
  email_message_id: string | null;
  is_manually_added: boolean;
  metadata?: TransactionMetadata;
  created_at: string; // ISO String
  updated_at: string; // ISO String

  // Optional Extended Fields
  exact_timestamp?: string;
  email_subject?: string;
  email_sender?: string;
  gmail_thread_id?: string;
  gmail_account_index?: number;
  currency_code?: string;
  original_amount?: number;
  reference_number?: string;
  transaction_subtype?: string;
  direction?: 'debit' | 'credit' | string;
  instrument_type?: string;
  instrument_id?: string;
  parent_transaction_id?: string | null;
  classification_method?: string;
  confidence_score?: number;
  needs_review?: boolean;
  review_reason?: string;
  counterparty_name?: string;
  counterparty_identifier?: string;

  // New Architecture Fields (Migration 026)
  rrn?: string;
  utr?: string;
  arn?: string;
  auth_code?: string;
  posting_date?: string;
  value_date?: string;
  transaction_status?: TransactionStatus;
  running_balance?: number;
  fx_rate?: number;
  original_currency_code?: string;

  fee_components?: {
    gst?: number;
    tax?: number;
    service_charge?: number;
    [key: string]: number | undefined;
  };

  instrument_details?: {
    card_last4?: string;
    account_masked?: string;
    upi_vpa_payer?: string;
    upi_vpa_payee?: string;
    [key: string]: string | undefined;
  };

  channel?: TransactionChannel;
  mcc?: string;

  is_recurring?: boolean;
  is_reversal?: boolean;
  is_provisional?: boolean;
  is_adjustment?: boolean;
  dispute_flag?: boolean;
  chargeback_flag?: boolean;

  linked_transaction_id?: string;
  link_type?: TransactionLinkType;

  parser_version?: string;
  rule_id?: string;
  pattern_group_id?: string;
  extraction_quality_score?: number;
  review_assignee?: string;
  source_message_timestamp?: string;

  // Category Hierarchy
  category_id?: string;
  category_confidence?: number;
  category_override_by_user?: boolean;

  // Frontend Joined Fields
  card?: CreditCard;
}

// ============================================
// Filters
// ============================================

/**
 * Filters for querying transactions
 */
export interface TransactionFilters {
  // Core filters
  card_id?: string;
  cardId?: string; // Legacy/API alias
  month?: number;
  year?: number;
  billMonth?: number; // API alias
  billYear?: number; // API alias

  // Date range (API expects strings YYYY-MM-DD or ISO)
  from?: string;
  to?: string;
  start_date?: string; // Legacy alias
  end_date?: string;   // Legacy alias

  // Classification
  category?: string;
  category_id?: string;
  merchant?: string;
  transaction_type?: TransactionType;
  transactionType?: string; // API alias
  type?: "revenue" | "expense"; // For legacy UI components
  direction?: 'debit' | 'credit';

  // Filters
  min_amount?: number;
  max_amount?: number;
  search?: string;

  // Status & Flags
  transaction_status?: TransactionStatus;
  needs_review?: boolean;
  is_recurring?: boolean;
  is_reversal?: boolean;
  has_dispute?: boolean;
  has_chargeback?: boolean;

  // Metadata
  instrument_type?: string;
  instrument_id?: string;
  channel?: TransactionChannel;
  rrn?: string;
  utr?: string;
  linked_transaction_id?: string;

  // Pagination & Sorting
  page?: number;
  limit?: number;
  sort_by?: string;   // Match backend snake_case
  sortBy?: string;    // API uses this
  sort_order?: "asc" | "desc";
  sortOrder?: "asc" | "desc"; // API uses this
}

/**
 * API Response for transaction list
 */
export interface TransactionListResponse {
  data: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  aggregations?: {
    totalSpent: number;
    totalTransactions: number;
    byCategory: Record<string, number>;
  };
}

// ============================================
// Forms & Requests
// ============================================

/**
 * Form data for creating/updating a transaction
 */
export interface TransactionFormData {
  amount: number;
  transactionDate: string; // camelCase (primary)
  transaction_date?: string; // snake_case (optional alias)
  merchant: string;
  category: string;
  cardId: string; // camelCase (primary)
  card_id?: string; // snake_case (optional alias)
  description?: string;
  billMonth?: number; // camelCase (primary)
  bill_month?: number; // snake_case (optional alias)
  billYear?: number; // camelCase (primary)
  bill_year?: number; // snake_case (optional alias)
  transactionType?: TransactionType | "debit" | "credit" | "refund" | "bill_payment"; // camelCase - allowing full union
  transaction_type?: TransactionType;
  parentTransactionId?: string;
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

// ============================================
// Category Hierarchy
// ============================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id?: string;
  icon?: string;
  color?: string;
  description?: string;
  is_system: boolean;
  is_personal: boolean;
  is_tax_deductible: boolean;
  sort_order: number;
  children?: Category[];
}
