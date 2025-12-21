import pool from '../../lib/db';

/**
 * Get all statements (monthly summaries) for a user
 */
export async function getAllStatements(userId: string) {
  const result = await pool.query(
    `SELECT 
      cc.id as card_id,
      cc.card_name,
      cc.bank_name,
      cc.card_number_last4,
      t.bill_year,
      t.bill_month,
      COUNT(t.id) as transaction_count,
      SUM(CASE WHEN t.transaction_type = 'debit' THEN t.amount ELSE 0 END) as total_debits,
      SUM(CASE WHEN t.transaction_type = 'credit' THEN t.amount ELSE 0 END) as total_credits,
      SUM(CASE WHEN t.transaction_type = 'debit' THEN t.amount ELSE -t.amount END) as net_amount
    FROM credit_cards cc
    LEFT JOIN transactions t ON cc.id = t.card_id
    WHERE cc.user_id = $1 
      AND t.bill_year IS NOT NULL 
      AND t.bill_month IS NOT NULL
    GROUP BY cc.id, cc.card_name, cc.bank_name, cc.card_number_last4, t.bill_year, t.bill_month
    ORDER BY t.bill_year DESC, t.bill_month DESC`,
    [userId]
  );

  return result.rows;
}

/**
 * Get statement details for a specific card and billing period
 */
export async function getStatementDetails(
  userId: string,
  cardId: string,
  month: number,
  year: number
) {
  const result = await pool.query(
    `
    WITH card_data AS (
      SELECT * FROM credit_cards WHERE id = $1 AND user_id = $2
    ),
    txn_data AS (
      SELECT * FROM transactions
      WHERE card_id = $1 AND bill_month = $3 AND bill_year = $4
      ORDER BY transaction_date DESC
    ),
    bill_data AS (
      SELECT * FROM bill_payments
      WHERE card_id = $1 AND bill_month = $3 AND bill_year = $4
      LIMIT 1
    ),
    summary_stats AS (
      SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END), 0) as total_debits,
        COALESCE(SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END), 0) as total_credits,
        COUNT(*) as transaction_count
      FROM txn_data
    )
    SELECT 
      (SELECT row_to_json(c) FROM card_data c) as card,
      (SELECT json_agg(t) FROM txn_data t) as transactions,
      (SELECT row_to_json(b) FROM bill_data b) as bill_payment,
      (SELECT row_to_json(s) FROM summary_stats s) as summary
    FROM card_data -- Ensure we only return if card exists
    `,
    [cardId, userId, month, year]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  const summary = row.summary;

  // Calculate net amount in JS or SQL (already have debits/credits)
  // Ensure we format the response correctly
  return {
    card: row.card,
    billingPeriod: {
      month,
      year,
    },
    transactions: row.transactions || [],
    summary: {
      totalDebits: parseFloat(summary.total_debits),
      totalCredits: parseFloat(summary.total_credits),
      netAmount: parseFloat(summary.total_debits) - parseFloat(summary.total_credits),
      transactionCount: parseInt(summary.transaction_count),
    },
    billPayment: row.bill_payment || null,
  };
}

/**
 * Get statements for a specific card
 */
export async function getCardStatements(userId: string, cardId: string) {
  const result = await pool.query(
    `SELECT 
      t.bill_year,
      t.bill_month,
      COUNT(t.id) as transaction_count,
      SUM(CASE WHEN t.transaction_type = 'debit' THEN t.amount ELSE 0 END) as total_debits,
      SUM(CASE WHEN t.transaction_type = 'credit' THEN t.amount ELSE 0 END) as total_credits,
      SUM(CASE WHEN t.transaction_type = 'debit' THEN t.amount ELSE -t.amount END) as net_amount
    FROM transactions t
    INNER JOIN credit_cards cc ON t.card_id = cc.id
    WHERE t.card_id = $1 
      AND cc.user_id = $2
      AND t.bill_year IS NOT NULL 
      AND t.bill_month IS NOT NULL
    GROUP BY t.bill_year, t.bill_month
    ORDER BY t.bill_year DESC, t.bill_month DESC`,
    [cardId, userId]
  );

  return result.rows;
}
