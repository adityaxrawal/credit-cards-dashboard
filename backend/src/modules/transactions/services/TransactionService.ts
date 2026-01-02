/**
 * Transaction Service - Facade
 * 
 * This service now acts as a facade, delegating to specialized services.
 * Maintains backward compatibility with existing imports.
 * 
 * DECOMPOSITION (Issue #4 - CQRS-Lite):
 * - TransactionQueryService     → Read operations
 * - TransactionCommandService   → Write operations (CRUD)
 * - TransactionBusinessService  → Business logic (split, link, dedup)
 * - TransactionPipelineService  → Email/bulk ingestion
 */

import { TransactionQueryService, TransactionFilters } from './TransactionQueryService';
import { TransactionCommandService } from './TransactionCommandService';
import { TransactionBusinessService } from './TransactionBusinessService';
import { TransactionPipelineService, EmailTransactionData } from './TransactionPipelineService';
import { TransactionMetadata, Transaction } from '@shared/types/transaction.types';

// ============================================
// Query Operations (delegates to TransactionQueryService)
// ============================================

export async function listTransactions(userId: string, filters: TransactionFilters = {}) {
  return TransactionQueryService.list(userId, filters);
}

export async function getTransaction(userId: string, transactionId: string) {
  return TransactionQueryService.getById(userId, transactionId);
}

// ============================================
// Command Operations (delegates to TransactionCommandService)
// ============================================

export async function createManualTransaction(data: {
  userId: string;
  instrumentType: string;
  instrumentId: string;
  transactionDate: Date;
  merchant: string;
  category: string;
  amount: number;
  transactionType: string;
  direction: 'credit' | 'debit';
  description?: string;
  metadata?: TransactionMetadata;
  parentTransactionId?: string;
}) {
  return TransactionCommandService.createManual(data);
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  data: Partial<Transaction>
) {
  return TransactionCommandService.update(userId, transactionId, data);
}

export async function deleteTransaction(userId: string, transactionId: string) {
  return TransactionCommandService.delete(userId, transactionId);
}

export async function bulkUpdateTransactions(
  userId: string,
  transactionIds: string[],
  updates: Partial<Transaction>
): Promise<{ updated: number; failed: number }> {
  return TransactionCommandService.bulkUpdate(userId, transactionIds, updates);
}

export async function bulkDeleteTransactions(
  userId: string,
  transactionIds: string[]
): Promise<{ deleted: number; failed: number }> {
  return TransactionCommandService.bulkDelete(userId, transactionIds);
}

// ============================================
// Business Operations (delegates to TransactionBusinessService)
// ============================================

export async function splitTransaction(
  userId: string,
  transactionId: string,
  splits: Array<{ amount: number; category: string; description?: string; merchant?: string }>
) {
  return TransactionBusinessService.splitTransaction(userId, transactionId, splits);
}

export async function resolveDuplicate(
  userId: string,
  keepTransactionId: string,
  duplicateTransactionId: string
) {
  return TransactionBusinessService.resolveDuplicate(userId, keepTransactionId, duplicateTransactionId);
}

export async function linkRefund(
  userId: string,
  refundTransactionId: string,
  originalTransactionId: string
) {
  return TransactionBusinessService.linkRefund(userId, refundTransactionId, originalTransactionId);
}

// ============================================
// Pipeline Operations (delegates to TransactionPipelineService)
// ============================================

export async function insertFromEmail(userId: string, data: EmailTransactionData & {
  gmailAccountIndex?: number;
  originalAmount?: number;
  // Extended fields
  rrn?: string;
  utr?: string;
  arn?: string;
  authCode?: string;
  postingDate?: Date;
  valueDate?: Date;
  transactionStatus?: 'pending' | 'posted' | 'reversed' | 'failed' | 'hold';
  runningBalance?: number;
  fxRate?: number;
  originalCurrencyCode?: string;
  feeComponents?: { gst?: number; tax?: number; service_charge?: number };
  instrumentDetails?: Record<string, string>;
  channel?: string;
  mcc?: string;
  isRecurring?: boolean;
  isReversal?: boolean;
  isProvisional?: boolean;
  isAdjustment?: boolean;
  disputeFlag?: boolean;
  chargebackFlag?: boolean;
  linkedTransactionId?: string;
  linkType?: string;
  parserVersion?: string;
  ruleId?: string;
  patternGroupId?: string;
  extractionQualityScore?: number;
  reviewAssignee?: string;
  categoryId?: string;
  categoryConfidence?: number;
  rawEmailId?: string;
}) {
  return TransactionPipelineService.insertFromEmail(userId, data);
}

export async function insertFromEmailBulk(userId: string, items: Array<EmailTransactionData & {
  gmailAccountIndex?: number;
  originalAmount?: number;
  rrn?: string;
  utr?: string;
  arn?: string;
  authCode?: string;
  postingDate?: Date;
  valueDate?: Date;
  transactionStatus?: 'pending' | 'posted' | 'reversed' | 'failed' | 'hold';
  runningBalance?: number;
  fxRate?: number;
  originalCurrencyCode?: string;
  feeComponents?: { gst?: number; tax?: number; service_charge?: number };
  instrumentDetails?: Record<string, string>;
  channel?: string;
  mcc?: string;
  isRecurring?: boolean;
  isReversal?: boolean;
  isProvisional?: boolean;
  isAdjustment?: boolean;
  disputeFlag?: boolean;
  chargebackFlag?: boolean;
  linkedTransactionId?: string;
  linkType?: string;
  parserVersion?: string;
  ruleId?: string;
  patternGroupId?: string;
  extractionQualityScore?: number;
  reviewAssignee?: string;
  categoryId?: string;
  categoryConfidence?: number;
  rawEmailId?: string;
}>) {
  return TransactionPipelineService.insertFromEmailBulk(userId, items);
}

// Re-export specialized services for direct use
export { TransactionQueryService } from './TransactionQueryService';
export { TransactionCommandService } from './TransactionCommandService';
export { TransactionBusinessService } from './TransactionBusinessService';
export { TransactionPipelineService } from './TransactionPipelineService';
