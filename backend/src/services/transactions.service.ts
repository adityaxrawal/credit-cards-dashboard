import * as transactionsQueries from '../db/queries/transactions.queries';
import * as cardsQueries from '../db/queries/cards.queries';
import dayjs from 'dayjs';

// import { ExtractionResult } from './extraction.service'; // Removed

import pool from '../lib/db'; // For pool.query if needed or use queries
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
  }
) {
  const page = filters.page || 1;
  const limit = filters.limit || 50;
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
  metadata?: any;
}) {
  // Calculate bill month/year (simplified for manual)
  const txDate = dayjs(data.transactionDate);
  const billMonth = txDate.month() + 1;
  const billYear = txDate.year();

  return await transactionsQueries.createTransaction({
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
    classificationMethod: 'manual'
  });
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
  return await transactionsQueries.updateTransaction(userId, transactionId, data);
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(userId: string, transactionId: string) {
  return await transactionsQueries.deleteTransaction(userId, transactionId);
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
    metadata?: any;
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
  }
) {
  // Create fingerprint for deduplication
  const fingerprintData = `${data.emailMessageId}-${data.transactionDate.toISOString()}-${data.amount}-${data.merchant}`;
  const crypto = require('crypto');
  const txnFingerprint = crypto.createHash('sha256').update(fingerprintData).digest('hex');

  const txDate = dayjs(data.transactionDate);
  const billMonth = txDate.month() + 1;
  const billYear = txDate.year();

  return await transactionsQueries.createTransaction({
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
    metadata?: any;
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
  }>
) {
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

  return await transactionsQueries.createTransactionsBulk(transactionsToCreate);
}


