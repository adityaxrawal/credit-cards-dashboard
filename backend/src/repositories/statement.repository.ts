import { query } from '../lib/db';

export class StatementRepository {
  static async getAllStatements(userId: string) {
    const result = await query(
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

  static async getStatementDetails(
    userId: string,
    cardId: string,
    month: number,
    year: number
  ) {
    // Get card details
    const cardResult = await query(
      `SELECT * FROM credit_cards WHERE id = $1 AND user_id = $2`,
      [cardId, userId]
    );

    if (cardResult.rows.length === 0) {
      return null;
    }

    const card = cardResult.rows[0];

    // Get transactions for this billing period
    const transactionsResult = await query(
      `SELECT * FROM transactions
      WHERE card_id = $1 
        AND bill_month = $2 
        AND bill_year = $3
      ORDER BY transaction_date DESC`,
      [cardId, month, year]
    );

    const transactions = transactionsResult.rows;

    // Calculate summary
    const totalDebits = transactions
      .filter((t: any) => t.transaction_type === 'debit')
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount.toString()), 0);

    const totalCredits = transactions
      .filter((t: any) => t.transaction_type === 'credit')
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount.toString()), 0);

    // Get bill payment info if exists
    const billResult = await query(
      `SELECT * FROM bill_payments
      WHERE card_id = $1 AND bill_month = $2 AND bill_year = $3`,
      [cardId, month, year]
    );

    return {
      card,
      billingPeriod: {
        month,
        year,
      },
      transactions,
      summary: {
        totalDebits,
        totalCredits,
        netAmount: totalDebits - totalCredits,
        transactionCount: transactions.length,
      },
      billPayment: billResult.rows[0] || null,
    };
  }

  static async getCardStatements(userId: string, cardId: string) {
    const result = await query(
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
}
