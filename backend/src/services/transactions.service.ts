import * as transactionsQueries from '../db/queries/transactions.queries';
import * as cardsQueries from '../db/queries/cards.queries';
import dayjs from 'dayjs';

/**
 * List transactions with filters
 */
export async function listTransactions(
  userId: string,
  filters: {
    cardId?: string;
    from?: string;
    to?: string;
    billMonth?: number;
    billYear?: number;
    category?: string;
    transactionType?: string;
    merchant?: string;
    page?: number;
    limit?: number;
  }
) {
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const offset = (page - 1) * limit;
  
  const result = await transactionsQueries.listTransactions(userId, {
    cardId: filters.cardId,
    from: filters.from ? new Date(filters.from) : undefined,
    to: filters.to ? new Date(filters.to) : undefined,
    billMonth: filters.billMonth,
    billYear: filters.billYear,
    category: filters.category,
    transactionType: filters.transactionType,
    merchant: filters.merchant,
    limit,
    offset,
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

/**
 * Create a manual transaction
 */
export async function createManualTransaction(data: {
  userId: string;
  cardId: string;
  transactionDate: Date;
  merchant: string;
  category: string;
  amount: number;
  transactionType: string;
  description?: string;
}) {
  // Verify card belongs to user
  const card = await cardsQueries.getCardById(data.userId, data.cardId);
  if (!card) {
    throw new Error('Card not found');
  }
  
  // Calculate bill month/year based on card billing cycle
  const txDate = dayjs(data.transactionDate);
  const billMonth = txDate.month() + 1;
  const billYear = txDate.year();
  
  return await transactionsQueries.createTransaction({
    userId: data.userId,
    cardId: data.cardId,
    transactionDate: data.transactionDate,
    merchant: data.merchant,
    category: data.category,
    amount: data.amount,
    transactionType: data.transactionType,
    description: data.description,
    billMonth,
    billYear,
    isManuallyAdded: true,
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

/**
 * Insert transaction from email
 */
export async function insertFromEmail(
  userId: string,
  data: {
    cardId: string;
    amount: number;
    transactionDate: Date;
    merchant: string;
    category: string;
    emailMessageId: string;
    metadata?: any;
    exactTimestamp?: Date;
    emailSubject?: string;
    gmailThreadId?: string;
    gmailAccountIndex?: number;
    currencyCode?: string;
    originalAmount?: number;
    referenceNumber?: string;
    transactionSubtype?: string;
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
    cardId: data.cardId,
    transactionDate: data.transactionDate,
    merchant: data.merchant,
    category: data.category || 'Others',
    amount: data.amount,
    transactionType: 'debit',
    billMonth,
    billYear,
    emailMessageId: data.emailMessageId,
    txnFingerprint,
    isManuallyAdded: false,
    metadata: data.metadata,
    exactTimestamp: data.exactTimestamp,
    emailSubject: data.emailSubject,
    gmailThreadId: data.gmailThreadId,
    gmailAccountIndex: data.gmailAccountIndex,
    currencyCode: data.currencyCode,
    originalAmount: data.originalAmount,
    referenceNumber: data.referenceNumber,
    transactionSubtype: data.transactionSubtype,
  });
}
