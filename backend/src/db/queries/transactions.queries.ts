import pool from '../../lib/db';

import { Transaction, TransactionFilters, TransactionMetadata } from '../../types/transaction.types';

/**
 * Get pending review transactions
 */
export async function getPendingReviewTransactions(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ data: Transaction[]; total: number }> {
  return listTransactions(userId, { needsReview: true, limit, offset });
}

/**
 * List transactions with filters and pagination
 */
export async function listTransactions(
  userId: string,
  filters: TransactionFilters & { sortBy?: string; sortOrder?: 'asc' | 'desc' }
): Promise<{ data: Transaction[]; total: number }> {
  const safeFilters = filters ?? {};

  const where: string[] = ['t.user_id = $1'];
  const params: any[] = [userId];
  let paramIndex = 2;

  // Type guards for critical parameters
  if (safeFilters.cardId && typeof safeFilters.cardId !== 'string') {
    throw new Error('Invalid cardId type');
  }

  // Support legacy cardId filter by mapping to instrument_id
  if (safeFilters.cardId) {
    where.push(`t.instrument_id = $${paramIndex++}`);
    params.push(safeFilters.cardId);
  }
  if (safeFilters.instrumentType) {
    where.push(`t.instrument_type = $${paramIndex++}`);
    params.push(safeFilters.instrumentType);
  }
  if (safeFilters.instrumentId) {
    where.push(`t.instrument_id = $${paramIndex++}`);
    params.push(safeFilters.instrumentId);
  }
  if (safeFilters.direction) {
    where.push(`t.direction = $${paramIndex++}`);
    params.push(safeFilters.direction);
  }
  if (safeFilters.from) {
    where.push(`t.transaction_date >= $${paramIndex++}`);
    params.push(safeFilters.from);
  }

  if (safeFilters.to) {
    where.push(`t.transaction_date <= $${paramIndex++}`);
    params.push(safeFilters.to);
  }

  if (safeFilters.billMonth) {
    where.push(`t.bill_month = $${paramIndex++}`);
    params.push(safeFilters.billMonth);
  }

  if (safeFilters.billYear) {
    where.push(`t.bill_year = $${paramIndex++}`);
    params.push(safeFilters.billYear);
  }

  if (safeFilters.category) {
    where.push(`t.category = $${paramIndex++}`);
    params.push(safeFilters.category);
  }

  if (safeFilters.transactionType) {
    where.push(`t.transaction_type = $${paramIndex++}`);
    params.push(safeFilters.transactionType);
  }

  if (safeFilters.merchant) {
    where.push(`t.merchant ILIKE $${paramIndex++}`);
    params.push(`%${safeFilters.merchant}%`);
  }

  if (safeFilters.needsReview !== undefined) {
    where.push(`t.needs_review = $${paramIndex++}`);
    params.push(safeFilters.needsReview);
  }
  if (safeFilters.search) {
    // Use full-text search with tsvector if available, fallback to ILIKE
    // The search_vector column is created by migration 032_add_fulltext_search.sql
    where.push(`(
      t.search_vector @@ plainto_tsquery('english', $${paramIndex}) 
      OR t.merchant ILIKE $${paramIndex + 1} 
      OR t.description ILIKE $${paramIndex + 1}
    )`);
    params.push(safeFilters.search);
    params.push(`%${safeFilters.search}%`);
    paramIndex += 2;
  }



  const whereClause = where.join(' AND ');

  // Get paginated data with total count using window function
  const limit = safeFilters.limit || 50;
  const offset = safeFilters.offset || 0;

  // Sorting
  const sortBy = safeFilters.sortBy || 'transaction_date';
  const sortOrder = safeFilters.sortOrder || 'desc';

  // Validate sort column to prevent SQL injection
  const validSortColumns = ['transaction_date', 'amount', 'merchant', 'category'];
  const sortColumn = validSortColumns.includes(sortBy) ? `t.${sortBy}` : 't.transaction_date';
  const orderDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const dataResult = await pool.query(
    `SELECT t.*, 
      count(*) OVER() as total_count,
      json_build_object(
        'id', i.id,
        'card_name', i.name,
        'bank_name', b.name,
        'last_four', i.last4
      ) as card
     FROM transactions t
     LEFT JOIN instruments i ON t.instrument_id = i.id
     LEFT JOIN banks b ON i.bank_id = b.id
     WHERE ${whereClause}
     ORDER BY ${sortColumn} ${orderDirection}
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  const total = dataResult.rows.length > 0 ? parseInt(dataResult.rows[0].total_count) : 0;

  // Remove total_count from the individual objects to keep the response clean
  const data = dataResult.rows.map(row => {
    const { total_count, ...transaction } = row;
    return transaction;
  });

  return {
    data: data as Transaction[],
    total,
  };
}

/**
 * List transactions with cursor-based pagination
 * More efficient for large datasets than offset-based pagination
 */
export async function listTransactionsCursor(
  userId: string,
  filters: TransactionFilters & {
    cursor?: string; // Base64 encoded cursor
    direction?: 'forward' | 'backward';
    limit?: number;
  }
): Promise<{
  data: Transaction[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
}> {
  const safeFilters = filters ?? {};
  const limit = Math.min(safeFilters.limit || 50, 100);
  const direction = safeFilters.direction || 'forward';

  const where: string[] = ['t.user_id = $1'];
  const params: any[] = [userId];
  let paramIndex = 2;

  // Decode cursor if provided
  let cursorDate: Date | null = null;
  let cursorId: string | null = null;
  if (safeFilters.cursor) {
    try {
      const decoded = Buffer.from(safeFilters.cursor, 'base64').toString('utf8');
      const [dateStr, id] = decoded.split('|');
      cursorDate = new Date(dateStr);
      cursorId = id;
    } catch (e) {
      // Invalid cursor, ignore
    }
  }

  // Apply cursor constraint
  if (cursorDate && cursorId) {
    if (direction === 'forward') {
      where.push(`(t.transaction_date < $${paramIndex} OR (t.transaction_date = $${paramIndex} AND t.id < $${paramIndex + 1}))`);
    } else {
      where.push(`(t.transaction_date > $${paramIndex} OR (t.transaction_date = $${paramIndex} AND t.id > $${paramIndex + 1}))`);
    }
    params.push(cursorDate, cursorId);
    paramIndex += 2;
  }

  // Apply other filters
  if (safeFilters.instrumentId) {
    where.push(`t.instrument_id = $${paramIndex++}`);
    params.push(safeFilters.instrumentId);
  }
  if (safeFilters.category) {
    where.push(`t.category = $${paramIndex++}`);
    params.push(safeFilters.category);
  }
  if (safeFilters.from) {
    where.push(`t.transaction_date >= $${paramIndex++}`);
    params.push(safeFilters.from);
  }
  if (safeFilters.to) {
    where.push(`t.transaction_date <= $${paramIndex++}`);
    params.push(safeFilters.to);
  }

  const whereClause = where.join(' AND ');
  const orderDir = direction === 'forward' ? 'DESC' : 'ASC';

  // Fetch one extra to determine hasMore
  const dataResult = await pool.query(
    `SELECT t.*,
      json_build_object(
        'id', i.id,
        'card_name', i.name,
        'bank_name', b.name,
        'last_four', i.last4
      ) as card
     FROM transactions t
     LEFT JOIN instruments i ON t.instrument_id = i.id
     LEFT JOIN banks b ON i.bank_id = b.id
     WHERE ${whereClause}
     ORDER BY t.transaction_date ${orderDir}, t.id ${orderDir}
     LIMIT $${paramIndex}`,
    [...params, limit + 1]
  );

  let data = dataResult.rows;
  const hasMore = data.length > limit;

  // Remove the extra item
  if (hasMore) {
    data = data.slice(0, limit);
  }

  // Reverse if going backward
  if (direction === 'backward') {
    data = data.reverse();
  }

  // Generate cursors
  const encodeCursor = (tx: any): string => {
    const cursorStr = `${tx.transaction_date.toISOString()}|${tx.id}`;
    return Buffer.from(cursorStr).toString('base64');
  };

  const nextCursor = data.length > 0 && hasMore
    ? encodeCursor(data[data.length - 1])
    : null;

  const prevCursor = data.length > 0 && safeFilters.cursor
    ? encodeCursor(data[0])
    : null;

  return {
    data: data as Transaction[],
    nextCursor,
    prevCursor,
    hasMore,
  };
}

/**
 * Get a single transaction
 */
export async function getTransactionById(
  userId: string,
  transactionId: string
): Promise<Transaction | null> {
  const { rows } = await pool.query(
    `SELECT * FROM transactions WHERE id = $1 AND user_id = $2`,
    [transactionId, userId]
  );
  return rows[0] || null;
}

/**
 * Find transaction by fingerprint (Date + Amount + Merchant Hash)
 * Used for deduplication across different sources (Email vs Statement)
 */
export async function findTransactionByFingerprint(
  userId: string,
  fingerprint: string
): Promise<Transaction | null> {
  const { rows } = await pool.query(
    `SELECT * FROM transactions 
     WHERE user_id = $1 AND txn_fingerprint = $2
     LIMIT 1`,
    [userId, fingerprint]
  );
  return rows[0] || null;
}

/**
 * Create a new transaction
 */
export async function createTransaction(data: {
  userId: string;
  instrumentType?: string;
  instrumentId?: string;
  cardId?: string; // Legacy
  transactionDate: Date;
  merchant: string;
  category: string;
  amount: number;
  transactionType: string;
  direction?: string;
  counterpartyName?: string;
  counterpartyIdentifier?: string;
  referenceNumber?: string;
  description?: string;
  billMonth?: number;
  billYear?: number;
  emailMessageId?: string;
  txnFingerprint?: string;
  isManuallyAdded?: boolean;
  metadata?: TransactionMetadata;
  exactTimestamp?: Date;
  emailSubject?: string;
  emailSender?: string;
  gmailThreadId?: string;
  gmailAccountIndex?: number;
  currencyCode?: string;
  originalAmount?: number;
  transactionSubtype?: string;
  classificationMethod?: string;
  confidenceScore?: number;
  needsReview?: boolean;
  reviewReason?: string;
  rawExtraction?: any;
  scanJobId?: string;
  rawEmailId?: string;
}): Promise<Transaction | null> {
  // Truncate fields to match database VARCHAR limits
  const truncatedMerchant = data.merchant?.substring(0, 255) || data.merchant;
  const truncatedCategory = data.category?.substring(0, 100) || data.category;
  const truncatedEmailMessageId = data.emailMessageId?.substring(0, 255) || data.emailMessageId;
  const truncatedEmailSubject = data.emailSubject?.substring(0, 500) || data.emailSubject;
  const truncatedReferenceNumber = data.referenceNumber?.substring(0, 100) || data.referenceNumber;

  // Map legacy cardId
  const instrumentId = data.instrumentId || data.cardId;
  const instrumentType = data.instrumentType || (data.cardId ? 'credit_card' : undefined);

  const { rows } = await pool.query(
    `INSERT INTO transactions (
      user_id, instrument_type, instrument_id, transaction_date, merchant, category,
      amount, transaction_type, direction, counterparty_name, counterparty_identifier,
      reference_number, description, bill_month, bill_year,
      email_message_id, email_subject, email_sender, txn_fingerprint,
      is_manually_added, metadata, raw_extraction, classification_method,
      confidence_score, needs_review, review_reason, exact_timestamp,
      gmail_thread_id, gmail_account_index,
      currency_code, original_amount, transaction_subtype,
      scan_job_id, raw_email_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
    ON CONFLICT (email_message_id, txn_fingerprint) DO NOTHING
    RETURNING *`,
    [
      data.userId,
      instrumentType,
      instrumentId,
      data.transactionDate,
      truncatedMerchant,
      truncatedCategory,
      data.amount,
      data.transactionType,
      data.direction,
      data.counterpartyName,
      data.counterpartyIdentifier,
      truncatedReferenceNumber,
      data.description || null,
      data.billMonth || null,
      data.billYear || null,
      truncatedEmailMessageId,
      truncatedEmailSubject,
      data.emailSender || null,
      data.txnFingerprint || null,
      data.isManuallyAdded || false,
      data.metadata || null,
      data.rawExtraction || null,
      data.classificationMethod,
      data.confidenceScore || null,
      data.needsReview || false,
      data.reviewReason || null,
      data.exactTimestamp || null,
      data.gmailThreadId || null,
      data.gmailAccountIndex || 1,
      data.currencyCode || null,
      data.originalAmount || null,
      data.transactionSubtype || null,
      data.scanJobId || null,
      data.rawEmailId || null
    ]
  ).catch(err => {
    // 23505 is Unique Violation (for logical_fingerprint)
    if (err.code === '23505') {
      return { rows: [] };
    }
    throw err;
  });
  return rows[0] || null;
}

/**
 * Bulk create transactions - optimized for high performance
 * Inserts multiple transactions in a single query
 */
export async function createTransactionsBulk(dataList: Array<{
  userId: string;
  instrumentType?: string;
  instrumentId?: string;
  cardId?: string;
  transactionDate: Date;
  merchant: string;
  category: string;
  amount: number;
  transactionType: string;
  direction?: string;
  counterpartyName?: string;
  counterpartyIdentifier?: string;
  referenceNumber?: string;
  description?: string;
  billMonth?: number;
  billYear?: number;
  emailMessageId?: string;
  emailSubject?: string;
  emailSender?: string;
  txnFingerprint?: string;
  isManuallyAdded?: boolean;
  metadata?: TransactionMetadata;
  exactTimestamp?: Date;
  gmailThreadId?: string;
  gmailAccountIndex?: number;
  currencyCode?: string;
  originalAmount?: number;
  transactionSubtype?: string;
  classificationMethod?: string;
  confidenceScore?: number;
  needsReview?: boolean;
  reviewReason?: string;
  rawExtraction?: any;
  scanJobId?: string;
  rawEmailId?: string;
}>): Promise<Transaction[]> {
  if (dataList.length === 0) return [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const data of dataList) {
      // Truncate fields to match database VARCHAR limits
      const truncatedMerchant = data.merchant?.substring(0, 255) || data.merchant;
      const truncatedCategory = data.category?.substring(0, 100) || data.category;
      const truncatedEmailMessageId = data.emailMessageId?.substring(0, 255) || data.emailMessageId;
      const truncatedEmailSubject = data.emailSubject?.substring(0, 500) || data.emailSubject;
      const truncatedReferenceNumber = data.referenceNumber?.substring(0, 100) || data.referenceNumber;

      const instrumentId = data.instrumentId || data.cardId;
      const instrumentType = data.instrumentType || (data.cardId ? 'credit_card' : undefined);

      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12}, $${paramIndex + 13}, $${paramIndex + 14}, $${paramIndex + 15}, $${paramIndex + 16}, $${paramIndex + 17}, $${paramIndex + 18}, $${paramIndex + 19}, $${paramIndex + 20}, $${paramIndex + 21}, $${paramIndex + 22}, $${paramIndex + 23}, $${paramIndex + 24}, $${paramIndex + 25}, $${paramIndex + 26}, $${paramIndex + 27}, $${paramIndex + 28}, $${paramIndex + 29}, $${paramIndex + 30}, $${paramIndex + 31}, $${paramIndex + 32}, $${paramIndex + 33})`
      );
      values.push(
        data.userId,
        instrumentType || null,
        instrumentId || null,
        data.transactionDate,
        truncatedMerchant,
        truncatedCategory,
        data.amount,
        data.transactionType,
        data.direction || null,
        data.counterpartyName || null,
        data.counterpartyIdentifier || null,
        truncatedReferenceNumber || null,
        data.description || null,
        data.billMonth || null,
        data.billYear || null,
        truncatedEmailMessageId,
        truncatedEmailSubject || null,
        data.emailSender || null,
        data.txnFingerprint || null,
        data.isManuallyAdded || false,
        data.metadata || null,
        data.rawExtraction || null,
        data.classificationMethod || null,
        data.confidenceScore || null,
        data.needsReview || false,
        data.reviewReason || null,
        data.exactTimestamp || null,
        data.gmailThreadId || null,
        data.gmailAccountIndex || 1,
        data.currencyCode || null,
        data.originalAmount || null,
        data.transactionSubtype || null,
        data.scanJobId || null,
        data.rawEmailId || null
      );
      paramIndex += 34;
    }

    const query = `
      INSERT INTO transactions (
        user_id, instrument_type, instrument_id, transaction_date, merchant, category,
        amount, transaction_type, direction, counterparty_name, counterparty_identifier,
        reference_number, description, bill_month, bill_year,
        email_message_id, email_subject, email_sender, txn_fingerprint,
        is_manually_added, metadata, raw_extraction, classification_method,
        confidence_score, needs_review, review_reason, exact_timestamp,
        gmail_thread_id, gmail_account_index,
        currency_code, original_amount, transaction_subtype,
        scan_job_id, raw_email_id
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT (email_message_id, txn_fingerprint) DO NOTHING
      RETURNING *
    `;

    const result = await client.query(query, values);
    await client.query('COMMIT');

    return result.rows;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
    isSettled: boolean;
  }>
): Promise<Transaction | null> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.merchant !== undefined) {
    updates.push(`merchant = $${paramIndex++}`);
    values.push(data.merchant);
  }
  if (data.category !== undefined) {
    updates.push(`category = $${paramIndex++}`);
    values.push(data.category);
  }
  if (data.amount !== undefined) {
    updates.push(`amount = $${paramIndex++}`);
    values.push(data.amount);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.isSettled !== undefined) {
    updates.push(`is_settled = $${paramIndex++}`);
    values.push(data.isSettled);
  }

  if (updates.length === 0) return null;

  updates.push(`updated_at = NOW()`);
  values.push(transactionId, userId);

  const { rows } = await pool.query(
    `UPDATE transactions 
     SET ${updates.join(', ')} 
     WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
     RETURNING *`,
    values
  );

  return rows[0] || null;
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(
  userId: string,
  transactionId: string
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM transactions WHERE id = $1 AND user_id = $2`,
    [transactionId, userId]
  );
  return (rowCount || 0) > 0;
}

/**
 * Check if email message already processed
 */
export async function isDuplicateEmail(
  userId: string,
  emailMessageId: string
): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM transactions 
     WHERE user_id = $1 AND email_message_id = $2 
     LIMIT 1`,
    [userId, emailMessageId]
  );
  return rows.length > 0;
}

/**
 * Get spending aggregations
 */
export async function getSpendingAggregations(
  userId: string,
  filters: TransactionFilters
): Promise<{
  totalSpent: number;
  totalTransactions: number;
  byCategory: Array<{ category: string; total: number; count: number }>;
}> {
  const where: string[] = ['user_id = $1', "direction = 'debit'"];
  const params: any[] = [userId];
  let paramIndex = 2;
  const safeFilters = filters || {};

  if (safeFilters.from) {
    where.push(`transaction_date >= $${paramIndex++}`);
    params.push(safeFilters.from);
  }

  if (safeFilters.to) {
    where.push(`transaction_date <= $${paramIndex++}`);
    params.push(safeFilters.to);
  }

  if (safeFilters.billMonth && safeFilters.billYear) {
    where.push(`bill_month = $${paramIndex++} AND bill_year = $${paramIndex++}`);
    params.push(safeFilters.billMonth, safeFilters.billYear);
  }

  const whereClause = where.join(' AND ');

  // Combined aggregation
  const result = await pool.query(
    `SELECT 
      category, 
      SUM(amount) as cat_total, 
      COUNT(*) as cat_count,
      SUM(SUM(amount)) OVER() as grand_total,
      SUM(COUNT(*)) OVER() as grand_count
     FROM transactions 
     WHERE ${whereClause}
     GROUP BY category
     ORDER BY cat_total DESC`,
    params
  );

  const rows = result.rows;
  const totalSpent = rows.length > 0 ? parseFloat(rows[0].grand_total) : 0;
  const totalTransactions = rows.length > 0 ? parseInt(rows[0].grand_count) : 0;

  return {
    totalSpent,
    totalTransactions,
    byCategory: rows.map(row => ({
      category: row.category,
      total: parseFloat(row.cat_total),
      count: parseInt(row.cat_count),
    })),
  };
}
