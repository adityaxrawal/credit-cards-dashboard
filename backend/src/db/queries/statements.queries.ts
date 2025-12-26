import pool from '../../lib/db';

/**
 * Get all statements (monthly summaries) for a user
 */
export async function getAllStatements(userId: string) {
  const result = await pool.query(
    `SELECT 
      i.id as card_id,
      i.name as card_name,
      b.name as bank_name,
      i.last4 as card_number_last4,
      t.bill_year,
      t.bill_month,
      COUNT(t.id) as transaction_count,
      SUM(CASE WHEN t.transaction_type = 'debit' THEN t.amount ELSE 0 END) as total_debits,
      SUM(CASE WHEN t.transaction_type = 'credit' THEN t.amount ELSE 0 END) as total_credits,
      SUM(CASE WHEN t.transaction_type = 'debit' THEN t.amount ELSE -t.amount END) as net_amount
    FROM instruments i
    LEFT JOIN banks b ON i.bank_id = b.id
    LEFT JOIN transactions t ON i.id = t.instrument_id
    WHERE i.user_id = $1 
      AND i.type = 'credit_card'
      AND t.bill_year IS NOT NULL 
      AND t.bill_month IS NOT NULL
    GROUP BY i.id, i.name, b.name, i.last4, t.bill_year, t.bill_month
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
      SELECT i.*, b.name as bank_name 
      FROM instruments i
      LEFT JOIN banks b ON i.bank_id = b.id
      WHERE i.id = $1 AND i.user_id = $2
    ),
    txn_data AS (
      SELECT * FROM transactions
      WHERE instrument_id = $1 AND bill_month = $3 AND bill_year = $4
      ORDER BY transaction_date DESC
    ),
    bill_data AS (
      SELECT * FROM bill_payments
      WHERE instrument_id = $1 AND bill_month = $3 AND bill_year = $4
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
    card: {
      ...row.card,
      card_name: row.card.name, // Map back logic for frontend if needed
      card_number_last4: row.card.last4
    },
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
    INNER JOIN instruments i ON t.instrument_id = i.id
    WHERE t.instrument_id = $1 
      AND i.user_id = $2
      AND t.bill_year IS NOT NULL 
      AND t.bill_month IS NOT NULL
    GROUP BY t.bill_year, t.bill_month
    ORDER BY t.bill_year DESC, t.bill_month DESC`,
    [cardId, userId]
  );

  return result.rows;
}
