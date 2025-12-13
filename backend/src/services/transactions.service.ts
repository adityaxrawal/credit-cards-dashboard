import * as transactionsQueries from '../db/queries/transactions.queries';
import * as cardsQueries from '../db/queries/cards.queries';
import dayjs from 'dayjs';
import { cardDetectionService } from './extraction/cardDetectionService';
import { ExtractionResult } from './extraction.service'; // Assuming this type is exported or we need to redefine simplified version
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
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
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

/**
 * Bulk insert transactions from emails
 */
export async function insertFromEmailBulk(
  userId: string,
  items: Array<{
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
    };
  });

  return await transactionsQueries.createTransactionsBulk(transactionsToCreate);
}

// NEW: Transaction Creation with Robust Card Detection
export async function createTransactionFromExtraction(
  userId: string,
  extractedData: {
    amount: number;
    merchant: string;
    date: Date;
    bankName?: string;
    extractionMethod: string;
    confidence?: number;
    [key: string]: any;
  },
  email: { id: string; subject: string; body: string; from: string }
) {

  // DETECT CARD FIRST
  const cardDetection = await cardDetectionService.detectCardFromEmail(
    userId,
    email,
    extractedData.bankName
  );

  let card = null;

  // Try exact match first or fuzzy match result
  // detectCardFromEmail already returns 'cardName' if fuzzy matched.
  // But we need the ID from DB.

  if (cardDetection.confidence >= 0.85) {
    // If we have a detected last4 and bank, we try to find it.
    // OR if fuzzy match gave us a card, we use it.
    // Convert detection result to DB lookup.

    // Note: cardDetectionService uses query on pool.
    // Here we can use cardsQueries.
    // But wait, cardDetectionService returns { last4, bankName } OR fuzzy match.

    if (cardDetection.detectionMethod === 'fuzzy' && cardDetection.cardName) {
      // It matched an existing card!
      // We should have the ID in detection result?
      // The provided detection service code in Step 87 "fuzzyMatchExistingCard" returns { cardName, confidence } but NOT ID.
      // That's a flaw in the provided code vs usage.
      // I should stick to the "detectCardFromEmail" signature.
      // I will query DB using the last4 and bankName from detection.
    }

    const cards = await cardsQueries.getUserCards(userId);
    // Filter locally
    card = cards.find((c: any) =>
      c.card_number_last4 === cardDetection.last4Digits &&
      (c.bank_name === cardDetection.bankName || cardDetection.bankName === 'Unknown')
    );
  }

  // If no exact match, check if user needs to manually assign
  if (!card && cardDetection.confidence < 0.85) {
    // Create transaction in PENDING state, require manual card mapping
    // User requested "only return shouldProcess=true for debit" in Issue #3, 
    // but here we are "Creating transaction".
    // If we can't map card, we might fail or store with null card?
    // User code says: return { status: 'PENDING_CARD_MAPPING', ... }

    // BUT transaction table requires card_id usually.
    // Let's check schema/queries. `createTransaction` likely requires cardId.
    // If I return an object, I'm not creating a transaction yet?
    // The Prompt says: "return transaction.rows" at the end.
    // If PENDING, it returns an object.

    // I will return the pending status object.
    return {
      status: 'PENDING_CARD_MAPPING',
      cardDetectionHint: cardDetection,
      message: `Could not auto-detect card (${cardDetection.bankName} ${cardDetection.last4Digits}). ` +
        `Please manually select the card for this transaction.`
    };
  }

  if (!card) {
    // It might be a new card?
    // For now, if high confidence extraction but no card found in DB, we error or creating new card is risk.
    // Prompt says: "Card not found... throw Error"
    throw new Error(
      `Card not found: ${cardDetection.bankName} ending in ${cardDetection.last4Digits}`
    );
  }

  // Validate extracted amount
  if (extractedData.amount <= 0) {
    // Credit limit check might be overkill here if we just want to track.
    throw new Error('Amount validation failed');
  }

  // Create transaction
  const crypto = require('crypto');
  const fingerprint = crypto.createHash('sha256')
    .update(`${card.id}:${extractedData.amount}:${extractedData.merchant}:${extractedData.date}`)
    .digest('hex');

  const metadata = {
    card_detection_method: cardDetection.detectionMethod,
    bank: cardDetection.bankName,
    last4: cardDetection.last4Digits
  };

  // Insert using existing query helper or direct SQL
  // existing helper `insertFromEmail` does a lot of this.
  // I will reuse `insertFromEmail` logic but bypass its card resolution?
  // `insertFromEmail` takes `cardId`.

  // So I can just call:
  return await insertFromEmail(userId, {
    cardId: card.id,
    amount: extractedData.amount,
    transactionDate: extractedData.date,
    merchant: extractedData.merchant,
    category: 'Uncategorized',
    emailMessageId: email.id,
    metadata: metadata,
    emailSubject: email.subject
  });
}
