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
  | 'atm_withdrawal'
  | 'atm_inquiry'
  | 'sweep_in'
  | 'sweep_out'
  | 'standing_instruction'
  | 'enach'
  | 'cash_deposit'
  | 'wallet_load'
  | 'wallet_unload'
  | 'unclassified';

// ============================================
// Transaction Entity
// ============================================

/**
 * Transaction entity - Extended with all new fields
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

  // Extended fields (matching backend)
  user_id?: string;
  transaction_type?: TransactionType;
  direction?: 'debit' | 'credit';
  currency_code?: string;
  original_amount?: number;
  reference_number?: string;
  counterparty_name?: string;
  counterparty_identifier?: string;
  instrument_type?: string;
  instrument_id?: string;
  confidence_score?: number;
  needs_review?: boolean;
  review_reason?: string;
  email_message_id?: string;
  email_subject?: string;

  // Reference Numbers
  rrn?: string;
  utr?: string;
  arn?: string;
  auth_code?: string;

  // Date Differentiation
  posting_date?: string;
  value_date?: string;

  // Status & Lifecycle
  transaction_status?: TransactionStatus;

  // Balance & Currency
  running_balance?: number;
  fx_rate?: number;
  original_currency_code?: string;

  // Fee Components
  fee_components?: {
    gst?: number;
    tax?: number;
    service_charge?: number;
    [key: string]: number | undefined;
  };

  // Instrument Details
  instrument_details?: {
    card_last4?: string;
    account_masked?: string;
    upi_vpa_payer?: string;
    upi_vpa_payee?: string;
    [key: string]: string | undefined;
  };

  // Channel & Merchant
  channel?: TransactionChannel;
  mcc?: string;

  // Lifecycle Flags
  is_recurring?: boolean;
  is_reversal?: boolean;
  is_provisional?: boolean;
  is_adjustment?: boolean;
  dispute_flag?: boolean;
  chargeback_flag?: boolean;

  // Transaction Linking
  linked_transaction_id?: string;
  link_type?: TransactionLinkType;

  // Provenance
  parser_version?: string;
  rule_id?: string;
  pattern_group_id?: string;
  extraction_quality_score?: number;
  review_assignee?: string;

  // Category Hierarchy
  category_id?: string;
  category_confidence?: number;
  category_override_by_user?: boolean;
}

// ============================================
// Filters
// ============================================

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

  // Extended filters
  category_id?: string;
  channel?: TransactionChannel;
  transaction_status?: TransactionStatus;
  transaction_type?: TransactionType;
  direction?: 'debit' | 'credit';
  instrument_type?: string;
  instrument_id?: string;
  is_recurring?: boolean;
  is_reversal?: boolean;
  has_dispute?: boolean;
  has_chargeback?: boolean;
  needs_review?: boolean;
  rrn?: string;
  utr?: string;
  linked_transaction_id?: string;
}

// ============================================
// Forms & Requests
// ============================================

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
