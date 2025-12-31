import * as transactionsQueries from '../../db/queries/transactions.queries';
import * as cardsQueries from '../../db/queries/cards.queries';
import dayjs from 'dayjs';
import { TransactionMetadata } from '../../types/transaction.types';
import { invalidateTransactionCache } from '../../utils/cache/cacheInvalidation';

// import { ExtractionResult } from './extraction.service'; // Removed

import pool from '../../lib/db'; // For pool.query if needed or use queries
// Actually the provided code uses db.query directly. I should use the repositories/queries or pool.
// The provided code: await db.query(...)
// I will use pool.query for consistency with provided snippet or use existing queries if possible.
// Use pool directly for custom logic in this function to match user request closely.

/**
 * List transactions with filters
 */
export async function listTransactions(
  userId: string,
  filters: {
    cardId?: string;
    instrumentType?: string;
    instrumentId?: string;
    direction?: string;
    from?: string;
    to?: string;
    billMonth?: number;
    billYear?: number;
    category?: string;
    transactionType?: string;
    merchant?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    needsReview?: boolean;
    search?: string;
  } = {}
) {
  console.log(`[TransactionService] Listing transactions for user ${userId}`, filters);
  const safeFilters = filters || {};
  const page = safeFilters.page || 1;
  const limit = safeFilters.limit || 50;
  const offset = (page - 1) * limit;

  const result = await transactionsQueries.listTransactions(userId, {
    cardId: filters.cardId,
    instrumentType: filters.instrumentType,
    instrumentId: filters.instrumentId,
    direction: filters.direction,
    from: filters.from ? new Date(filters.from) : undefined,
    to: filters.to ? new Date(filters.to) : undefined,
    billMonth: filters.billMonth,
    billYear: filters.billYear,
    category: filters.category,
    transactionType: filters.transactionType,
    merchant: filters.merchant,
    limit,
    offset,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    needsReview: filters.needsReview,
    search: filters.search
  });

  const aggregations = await transactionsQueries.getSpendingAggregations(userId, {
    from: filters.from ? new Date(filters.from) : undefined,
    to: filters.to ? new Date(filters.to) : undefined,
    billMonth: filters.billMonth,
    billYear: filters.billYear,
  });

  return {
    data: result.data,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
    aggregations,
  };
}

/**
 * Get a single transaction
 */
export async function getTransaction(userId: string, transactionId: string) {
  return await transactionsQueries.getTransactionById(userId, transactionId);
}

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
  console.log(`[TransactionService] Creating manual transaction for user ${data.userId}`, data);
  // Calculate bill month/year (simplified for manual)
  const txDate = dayjs(data.transactionDate);
  const billMonth = txDate.month() + 1;
  const billYear = txDate.year();

  const result = await transactionsQueries.createTransaction({
    userId: data.userId,
    instrumentType: data.instrumentType,
    instrumentId: data.instrumentId,
    transactionDate: data.transactionDate,
    merchant: data.merchant,
    category: data.category,
    amount: data.amount,
    transactionType: data.transactionType,
    direction: data.direction,
    description: data.description,
    billMonth,
    billYear,
    isManuallyAdded: true,
    metadata: data.metadata,
    classificationMethod: 'manual',
    parentTransactionId: data.parentTransactionId
  });

  if (result) {
    await invalidateTransactionCache(data.userId);
  }
  return result;
}

/**
 * Update a transaction
 */
export async function updateTransaction(
  userId: string,
  transactionId: string,
  data: Partial<{
    merchant: string;
    category: string;
    amount: number;
    description: string;
  }>
) {
  const result = await transactionsQueries.updateTransaction(userId, transactionId, data);
  if (result) {
    await invalidateTransactionCache(userId);
  }
  return result;
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(userId: string, transactionId: string) {
  const result = await transactionsQueries.deleteTransaction(userId, transactionId);
  if (result) {
    await invalidateTransactionCache(userId);
  }
  return result;
}

export async function insertFromEmail(
  userId: string,
  data: {
    instrumentType: string;
    instrumentId?: string;
    cardId?: string;
    amount: number;
    transactionDate: Date;
    merchant: string;
    category: string;
    emailMessageId: string;
    direction: 'credit' | 'debit';
    metadata?: TransactionMetadata;
    exactTimestamp?: Date;
    emailSubject?: string;
    gmailThreadId?: string;
    gmailAccountIndex?: number;
    currencyCode?: string;
    originalAmount?: number;
    referenceNumber?: string;
    transactionType: string;
    transactionSubtype?: string;
    classificationMethod: string;
    rawExtraction?: any;
    scanJobId?: string;
    rawEmailId?: string;
    // Extended fields (Phase 1-5)
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
  }
) {
  console.log(`[TransactionService] Inserting transaction from email for user ${userId}, message ${data.emailMessageId}`);
  // Create fingerprint for deduplication
  const fingerprintData = `${data.emailMessageId}-${data.transactionDate.toISOString()}-${data.amount}-${data.merchant}`;
  const crypto = require('crypto');
  const txnFingerprint = crypto.createHash('sha256').update(fingerprintData).digest('hex');

  const txDate = dayjs(data.transactionDate);
  const billMonth = txDate.month() + 1;
  const billYear = txDate.year();

  // Check for duplicate fingerprint
  const existing = await transactionsQueries.getTransactionByFingerprint(userId, txnFingerprint);
  if (existing) {
    console.log(`[TransactionService] Skipping duplicate transaction ${txnFingerprint}`);
    return existing;
  }

  const result = await transactionsQueries.createTransaction({
    userId,
    instrumentType: data.instrumentType,
    instrumentId: data.instrumentId,
    cardId: data.cardId,
    transactionDate: data.transactionDate,
    merchant: data.merchant,
    category: data.category || 'Others',
    amount: data.amount,
    transactionType: data.transactionType,
    direction: data.direction,
    billMonth,
    billYear,
    emailMessageId: data.emailMessageId,
    txnFingerprint,
    isManuallyAdded: false,
    metadata: data.metadata,
    rawExtraction: data.rawExtraction,
    classificationMethod: data.classificationMethod,
    exactTimestamp: data.exactTimestamp,
    emailSubject: data.emailSubject,
    gmailThreadId: data.gmailThreadId,
    gmailAccountIndex: data.gmailAccountIndex,
    currencyCode: data.currencyCode,
    originalAmount: data.originalAmount,
    referenceNumber: data.referenceNumber,
    transactionSubtype: data.transactionSubtype,
    scanJobId: data.scanJobId,
    rawEmailId: data.rawEmailId
  });

  if (result) {
    await invalidateTransactionCache(userId);
  }
  return result;
}

export async function insertFromEmailBulk(
  userId: string,
  items: Array<{
    instrumentType: string;
    instrumentId?: string;
    cardId?: string;
    amount: number;
    transactionDate: Date;
    merchant: string;
    category: string;
    emailMessageId: string;
    direction: 'credit' | 'debit';
    metadata?: TransactionMetadata;
    exactTimestamp?: Date;
    emailSubject?: string;
    gmailThreadId?: string;
    gmailAccountIndex?: number;
    currencyCode?: string;
    originalAmount?: number;
    referenceNumber?: string;
    transactionType: string;
    transactionSubtype?: string;
    classificationMethod: string;
    rawExtraction?: any;
    scanJobId?: string;
    rawEmailId?: string;
    // Extended fields (Phase 1-5)
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
  }>
) {
  console.log(`[TransactionService] Inserting bulk transactions from email for user ${userId}, count: ${items.length}`);
  if (items.length === 0) return [];

  const crypto = require('crypto');

  const transactionsToCreate = items.map(data => {
    // Create fingerprint for deduplication
    const fingerprintData = `${data.emailMessageId}-${data.transactionDate.toISOString()}-${data.amount}-${data.merchant}`;
    const txnFingerprint = crypto.createHash('sha256').update(fingerprintData).digest('hex');

    const txDate = dayjs(data.transactionDate);
    const billMonth = txDate.month() + 1;
    const billYear = txDate.year();

    return {
      userId,
      instrumentType: data.instrumentType,
      instrumentId: data.instrumentId,
      cardId: data.cardId,
      transactionDate: data.transactionDate,
      merchant: data.merchant,
      category: data.category || 'Others',
      amount: data.amount,
      transactionType: data.transactionType,
      direction: data.direction,
      billMonth,
      billYear,
      emailMessageId: data.emailMessageId,
      txnFingerprint,
      isManuallyAdded: false,
      metadata: data.metadata,
      rawExtraction: data.rawExtraction,
      classificationMethod: data.classificationMethod,
      exactTimestamp: data.exactTimestamp,
      emailSubject: data.emailSubject,
      gmailThreadId: data.gmailThreadId,
      gmailAccountIndex: data.gmailAccountIndex,
      currencyCode: data.currencyCode,
      originalAmount: data.originalAmount,
      referenceNumber: data.referenceNumber,
      transactionSubtype: data.transactionSubtype,
      scanJobId: data.scanJobId,
      rawEmailId: data.rawEmailId
    };
  });

  // Filter out duplicates
  const fingerprints = transactionsToCreate.map(t => t.txnFingerprint);
  const existingFingerprints = await transactionsQueries.getExistingFingerprints(userId, fingerprints);
  const newTransactions = transactionsToCreate.filter(t => !existingFingerprints.includes(t.txnFingerprint));

  if (newTransactions.length === 0) {
    console.log('[TransactionService] No new transactions to insert (all duplicates)');
    return [];
  }

  const result = await transactionsQueries.createTransactionsBulk(newTransactions);

  if (result.length > 0) {
    await invalidateTransactionCache(userId);
  }

  return result;
}


/**
 * Bulk update transactions
 */
export async function bulkUpdateTransactions(
  userId: string,
  transactionIds: string[],
  updates: Partial<{
    merchant: string;
    category: string;
  }>
): Promise<{ updated: number; failed: number }> {
  console.log(`[TransactionService] Bulk updating ${transactionIds.length} transactions for user ${userId}`);

  let updated = 0;
  let failed = 0;

  for (const id of transactionIds) {
    try {
      const result = await transactionsQueries.updateTransaction(userId, id, updates);
      if (result) {
        updated++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`Failed to update transaction ${id}:`, error);
      failed++;
    }
  }

  if (updated > 0) {
    await invalidateTransactionCache(userId);
  }

  return { updated, failed };
}

/**
 * Bulk delete transactions
 */
export async function bulkDeleteTransactions(
  userId: string,
  transactionIds: string[]
): Promise<{ deleted: number; failed: number }> {
  console.log(`[TransactionService] Bulk deleting ${transactionIds.length} transactions for user ${userId}`);

  let deleted = 0;
  let failed = 0;

  for (const id of transactionIds) {
    try {
      const result = await transactionsQueries.deleteTransaction(userId, id);
      if (result) {
        deleted++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`Failed to delete transaction ${id}:`, error);
      failed++;
    }
  }

  if (deleted > 0) {
    await invalidateTransactionCache(userId);
  }

  return { deleted, failed };
}

/**
 * Split a transaction into multiple child transactions
 */
export async function splitTransaction(
  userId: string,
  transactionId: string,
  splits: Array<{ amount: number; category: string; description?: string; merchant?: string }>
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get original transaction
    const originalRes = await client.query(
      'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
      [transactionId, userId]
    );

    if (originalRes.rows.length === 0) throw new Error('Transaction not found');
    const original = originalRes.rows[0];

    // Verify amounts
    const totalSplit = splits.reduce((sum, s) => sum + s.amount, 0);
    // Use epsilon for float comparison
    if (Math.abs(totalSplit - Number(original.amount)) > 0.01) {
      throw new Error(`Split amounts (${totalSplit}) do not sum to total (${original.amount})`);
    }

    // Mark original as split
    await client.query(
      'UPDATE transactions SET is_split = true WHERE id = $1',
      [transactionId]
    );

    // Create children
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      await client.query(
        `INSERT INTO transactions (
                user_id, instrument_id, instrument_type, transaction_date, 
                amount, currency_code, direction, 
                merchant, category, description, 
                parent_transaction_id, split_index,
                bill_month, bill_year,
                is_manually_added
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)`,
        [
          userId, original.instrument_id, original.instrument_type, original.transaction_date,
          split.amount, original.currency_code, original.direction,
          split.merchant || original.merchant, split.category, split.description || original.description,
          transactionId, i,
          original.bill_month, original.bill_year
        ]
      );
    }

    await client.query('COMMIT');
    await invalidateTransactionCache(userId);
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Resolve a duplicate transaction
 */
export async function resolveDuplicate(
  userId: string,
  keepTransactionId: string,
  duplicateTransactionId: string
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete the duplicate
    await client.query(
      'DELETE FROM transactions WHERE id = $1 AND user_id = $2',
      [duplicateTransactionId, userId]
    );

    // Update the keepTransaction
    await client.query(
      'UPDATE transactions SET needs_review = false, review_reason = NULL WHERE id = $1',
      [keepTransactionId]
    );

    await client.query('COMMIT');
    await invalidateTransactionCache(userId);
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Link a refund to an original transaction
 */
export async function linkRefund(
  userId: string,
  refundTransactionId: string,
  originalTransactionId: string
) {
  const result = await pool.query(
    `UPDATE transactions 
         SET linked_transaction_id = $1, 
             link_type = 'refund',
             is_reversal = true
         WHERE id = $2 AND user_id = $3
         RETURNING id`,
    [originalTransactionId, refundTransactionId, userId]
  );

  if (result.rowCount && result.rowCount > 0) {
    await invalidateTransactionCache(userId);
    return true;
  }
  return false;
}

