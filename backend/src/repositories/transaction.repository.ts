import { query } from '../lib/db';

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

export class TransactionRepository {
  static async listTransactions(
    userId: string,
    filters: TransactionFilters
  ): Promise<{ data: Transaction[]; total: number }> {
    console.log('[TransactionRepository] listTransactions called', { userId, filters });

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
    console.log('[TransactionRepository] Query WHERE clause:', whereClause);
    console.log('[TransactionRepository] Query Params:', params);

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM transactions WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);
    console.log('[TransactionRepository] Total count found:', total);

    // Get paginated data
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    
    const dataResult = await query(
      `SELECT * FROM transactions 
       WHERE ${whereClause}
       ORDER BY transaction_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    console.log('[TransactionRepository] Data rows returned:', dataResult.rows.length);
    if (dataResult.rows.length > 0) {
      console.log('[TransactionRepository] Sample row:', dataResult.rows[0]);
    }

    return {
      data: dataResult.rows,
      total,
    };
  }

  static async getTransactionById(
    userId: string,
    transactionId: string
  ): Promise<Transaction | null> {
    const result = await query(
      `SELECT * FROM transactions WHERE id = $1 AND user_id = $2`,
      [transactionId, userId]
    );
    return result.rows[0] || null;
  }

  static async createTransaction(data: {
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
    isManuallyAdded?: boolean;
    metadata?: any;
    txnFingerprint?: string;
  }): Promise<Transaction> {
    // Deduplication check
    if (data.txnFingerprint) {
      const existing = await query(
        'SELECT * FROM transactions WHERE txn_fingerprint = $1 AND user_id = $2',
        [data.txnFingerprint, data.userId]
      );
      if (existing.rows.length > 0) {
        console.log(`[TransactionRepository] Duplicate transaction skipped: ${data.txnFingerprint}`);
        return existing.rows[0];
      }
    }

    const result = await query(
      `INSERT INTO transactions (
        user_id, card_id, transaction_date, merchant, category,
        amount, transaction_type, description, bill_month, bill_year,
        email_message_id, is_manually_added, metadata, txn_fingerprint
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
        data.isManuallyAdded || false,
        data.metadata || null,
        data.txnFingerprint || null
      ]
    );
    return result.rows[0];
  }

  static async updateTransaction(
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

    const result = await query(
      `UPDATE transactions 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  static async deleteTransaction(
    userId: string,
    transactionId: string
  ): Promise<boolean> {
    const result = await query(
      `DELETE FROM transactions WHERE id = $1 AND user_id = $2`,
      [transactionId, userId]
    );
    return (result.rowCount || 0) > 0;
  }

  static async isDuplicateEmail(
    userId: string,
    emailMessageId: string
  ): Promise<boolean> {
    const result = await query(
      `SELECT 1 FROM transactions 
       WHERE user_id = $1 AND email_message_id = $2 
       LIMIT 1`,
      [userId, emailMessageId]
    );
    return result.rows.length > 0;
  }

  static async getSpendingAggregations(
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
    const totalResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM transactions WHERE ${whereClause}`,
      params
    );

    // By category
    const categoryResult = await query(
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
}
