import * as transactionsQueries from '../db/queries/transactions.queries';
import * as cardsQueries from '../db/queries/cards.queries';
import dayjs from 'dayjs';
import { cardDetectionService } from './extraction/cardDetectionService';
import { cardAutoCreationService } from './extraction/cardAutoCreation';
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

  let cardId: string;

  if ('status' in cardDetection && cardDetection.status === 'CREATE_CARD') {
    // Auto-create card
    const autoCard = await cardAutoCreationService.autoCreateOrFindCard({
      userId,
      bankName: cardDetection.bankName,
      last4: (cardDetection as any).last4,
      cardName: undefined
    });
    cardId = autoCard.cardId;
    // Fetch full card object for later usage if needed (like fingerprinting with card.id)
    // Actually autoCard.cardId is enough for transaction creation.
  } else if ('status' in cardDetection && cardDetection.status === 'FOUND') {
    // It was found by regex + DB lookup inside detection service
    // But detection service returns "cardName" not ID?
    // Wait, my previous edit to cardDetectionService RETURNED { ... matched properties }
    // but didn't return ID.
    // I should have returned ID in cardDetectionService?
    // Strategy 3 in cardDetectionService calls findCardByBankAndLastFour which returns Card.
    // cardDetectionService returns CardDetectionResult which DOES NOT have ID.
    // This is a disconnect.

    // I should update cardDetectionService to include cardId in the result if found.
    // OR I lookup again here.
    // Looking up again is safer if I don't want to change CardDetectionResult interface too much right now.

    const existing = await cardsQueries.findCardByBankAndLastFour(
      userId,
      cardDetection.bankName,
      cardDetection.last4Digits
    );
    if (existing) {
      cardId = existing.id;
    } else {
      // Should not happen if status is FOUND
      throw new Error(`Card reported found but not retrievable: ${cardDetection.bankName} ${cardDetection.last4Digits}`);
    }
  } else {
    // Confidence low, or no card found.
    // Try to auto-create logic wrapper?
    // User's request says: use autoCreateOrFindCard.

    // Let's just use autoCreateOrFindCard for ALL cases where we have bank+last4?

    const bankName = 'bankName' in cardDetection ? cardDetection.bankName : undefined;
    const last4 = 'last4Digits' in cardDetection ? cardDetection.last4Digits :
      ('last4' in cardDetection ? (cardDetection as any).last4 : undefined);

    if (bankName && last4) {
      const autoCard = await cardAutoCreationService.autoCreateOrFindCard({
        userId,
        bankName,
        last4
      });
      cardId = autoCard.cardId;
    } else {
      // Fallback to manual mapping pending
      return {
        status: 'PENDING_CARD_MAPPING',
        cardDetectionHint: cardDetection,
        message: `Could not auto-detect card.`
      };
    }
  }

  // Fetch the card object to ensure we have it for fingerprinting
  const card = await cardsQueries.getCardById(userId, cardId);
  if (!card) throw new Error("Card not found after resolution");


  // Validate extracted amount
  if (extractedData.amount <= 0) {
    throw new Error('Amount validation failed');
  }

  // Create transaction
  const crypto = require('crypto');
  // Need to safely access properties for metadata
  const detectionMethod = 'detectionMethod' in cardDetection ? cardDetection.detectionMethod : 'auto_create';
  const finalBankName = 'bankName' in cardDetection ? cardDetection.bankName : ('bankName' in cardDetection ? (cardDetection as any).bankName : 'Unknown');
  const finalLast4 = 'last4Digits' in cardDetection ? cardDetection.last4Digits : ('last4' in cardDetection ? (cardDetection as any).last4 : 'Unknown');

  const fingerprint = crypto.createHash('sha256')
    .update(`${card.id}:${extractedData.amount}:${extractedData.merchant}:${extractedData.date}`)
    .digest('hex');

  const metadata = {
    card_detection_method: detectionMethod,
    bank: finalBankName,
    last4: finalLast4
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
