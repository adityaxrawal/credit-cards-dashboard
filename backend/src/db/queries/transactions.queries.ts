import pool from '../../lib/db';

export interface Transaction {
  id: string;
  user_id: string;
  card_id: string;
  transaction_date: Date;
  merchant: string;
  category: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  bill_month: number | null;
  bill_year: number | null;
  is_settled: boolean;
  email_message_id: string | null;
  is_manually_added: boolean;
  metadata: any;
  created_at: Date;
  updated_at: Date;
  exact_timestamp?: Date;
  email_subject?: string;
  gmail_thread_id?: string;
  gmail_account_index?: number;
  currency_code?: string;
  original_amount?: number;
  reference_number?: string;
  transaction_subtype?: string;
}

export interface TransactionFilters {
  cardId?: string;
  from?: Date;
  to?: Date;
  billMonth?: number;
  billYear?: number;
  category?: string;
  transactionType?: string;
  merchant?: string;
  limit?: number;
  offset?: number;
}

/**
 * List transactions with filters and pagination
 */
export async function listTransactions(
  userId: string,
  filters: TransactionFilters
): Promise<{ data: Transaction[]; total: number }> {
  const where: string[] = ['user_id = $1'];
  const params: any[] = [userId];
  let paramIndex = 2;

  if (filters.cardId) {
    where.push(`card_id = $${paramIndex++}`);
    params.push(filters.cardId);
  }

  if (filters.from) {
    where.push(`transaction_date >= $${paramIndex++}`);
    params.push(filters.from);
  }

  if (filters.to) {
    where.push(`transaction_date <= $${paramIndex++}`);
    params.push(filters.to);
  }

  if (filters.billMonth) {
    where.push(`bill_month = $${paramIndex++}`);
    params.push(filters.billMonth);
  }

  if (filters.billYear) {
    where.push(`bill_year = $${paramIndex++}`);
    params.push(filters.billYear);
  }

  if (filters.category) {
    where.push(`category = $${paramIndex++}`);
    params.push(filters.category);
  }

  if (filters.transactionType) {
    where.push(`transaction_type = $${paramIndex++}`);
    params.push(filters.transactionType);
  }

  if (filters.merchant) {
    where.push(`merchant ILIKE $${paramIndex++}`);
    params.push(`%${filters.merchant}%`);
  }

  const whereClause = where.join(' AND ');

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM transactions WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total);

  // Get paginated data
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  
  const dataResult = await pool.query(
    `SELECT * FROM transactions 
     WHERE ${whereClause}
     ORDER BY transaction_date DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  return {
    data: dataResult.rows,
    total,
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
 * Create a new transaction
 */
export async function createTransaction(data: {
  userId: string;
  cardId: string;
  transactionDate: Date;
  merchant: string;
  category: string;
  amount: number;
  transactionType: string;
  description?: string;
  billMonth?: number;
  billYear?: number;
  emailMessageId?: string;
  txnFingerprint?: string;
  isManuallyAdded?: boolean;
  metadata?: any;
  exactTimestamp?: Date;
  emailSubject?: string;
  gmailThreadId?: string;
  gmailAccountIndex?: number;
  currencyCode?: string;
  originalAmount?: number;
  referenceNumber?: string;
  transactionSubtype?: string;
}): Promise<Transaction | null> {
  const { rows } = await pool.query(
    `INSERT INTO transactions (
      user_id, card_id, transaction_date, merchant, category,
      amount, transaction_type, description, bill_month, bill_year,
      email_message_id, txn_fingerprint, is_manually_added, metadata,
      exact_timestamp, email_subject, gmail_thread_id, gmail_account_index,
      currency_code, original_amount, reference_number, transaction_subtype
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
    ON CONFLICT (email_message_id, txn_fingerprint) DO NOTHING
    RETURNING *`,
    [
      data.userId,
      data.cardId,
      data.transactionDate,
      data.merchant,
      data.category,
      data.amount,
      data.transactionType,
      data.description || null,
      data.billMonth || null,
      data.billYear || null,
      data.emailMessageId || null,
      data.txnFingerprint || null,
      data.isManuallyAdded || false,
      data.metadata || null,
      data.exactTimestamp || null,
      data.emailSubject || null,
      data.gmailThreadId || null,
      data.gmailAccountIndex || 0,
      data.currencyCode || null,
      data.originalAmount || null,
      data.referenceNumber || null,
      data.transactionSubtype || null,
    ]
  );
  return rows[0] || null;
}

/**
 * Bulk create transactions - optimized for high performance
 * Inserts multiple transactions in a single query
 */
export async function createTransactionsBulk(dataList: Array<{
  userId: string;
  cardId: string;
  transactionDate: Date;
  merchant: string;
  category: string;
  amount: number;
  transactionType: string;
  description?: string;
  billMonth?: number;
  billYear?: number;
  emailMessageId?: string;
  txnFingerprint?: string;
  isManuallyAdded?: boolean;
  metadata?: any;
  exactTimestamp?: Date;
  emailSubject?: string;
  gmailThreadId?: string;
  gmailAccountIndex?: number;
  currencyCode?: string;
  originalAmount?: number;
  referenceNumber?: string;
  transactionSubtype?: string;
}>): Promise<Transaction[]> {
  if (dataList.length === 0) return [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const data of dataList) {
      placeholders.push(
        `($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9}, $${paramIndex+10}, $${paramIndex+11}, $${paramIndex+12}, $${paramIndex+13}, $${paramIndex+14}, $${paramIndex+15}, $${paramIndex+16}, $${paramIndex+17}, $${paramIndex+18}, $${paramIndex+19}, $${paramIndex+20}, $${paramIndex+21})`
      );
      values.push(
        data.userId,
        data.cardId,
        data.transactionDate,
        data.merchant,
        data.category,
        data.amount,
        data.transactionType,
        data.description || null,
        data.billMonth || null,
        data.billYear || null,
        data.emailMessageId || null,
        data.txnFingerprint || null,
        data.isManuallyAdded || false,
        data.metadata || null,
        data.exactTimestamp || null,
        data.emailSubject || null,
        data.gmailThreadId || null,
        data.gmailAccountIndex || 0,
        data.currencyCode || null,
        data.originalAmount || null,
        data.referenceNumber || null,
        data.transactionSubtype || null
      );
      paramIndex += 22;
    }

    const query = `
      INSERT INTO transactions (
        user_id, card_id, transaction_date, merchant, category,
        amount, transaction_type, description, bill_month, bill_year,
        email_message_id, txn_fingerprint, is_manually_added, metadata,
        exact_timestamp, email_subject, gmail_thread_id, gmail_account_index,
        currency_code, original_amount, reference_number, transaction_subtype
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
  const where: string[] = ['user_id = $1', "transaction_type = 'debit'"];
  const params: any[] = [userId];
  let paramIndex = 2;

  if (filters.from) {
    where.push(`transaction_date >= $${paramIndex++}`);
    params.push(filters.from);
  }

  if (filters.to) {
    where.push(`transaction_date <= $${paramIndex++}`);
    params.push(filters.to);
  }

  if (filters.billMonth && filters.billYear) {
    where.push(`bill_month = $${paramIndex++} AND bill_year = $${paramIndex++}`);
    params.push(filters.billMonth, filters.billYear);
  }

  const whereClause = where.join(' AND ');

  // Total spent
  const totalResult = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
     FROM transactions WHERE ${whereClause}`,
    params
  );

  // By category
  const categoryResult = await pool.query(
    `SELECT category, SUM(amount) as total, COUNT(*) as count
     FROM transactions 
     WHERE ${whereClause}
     GROUP BY category
     ORDER BY total DESC`,
    params
  );

  return {
    totalSpent: parseFloat(totalResult.rows[0].total),
    totalTransactions: parseInt(totalResult.rows[0].count),
    byCategory: categoryResult.rows.map(row => ({
      category: row.category,
      total: parseFloat(row.total),
      count: parseInt(row.count),
    })),
  };
}
