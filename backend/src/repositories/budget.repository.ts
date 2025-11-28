import { query } from '../lib/db';

export interface BudgetTracking {
  id: string;
  user_id: string;
  month: number;
  year: number;
  budget_limit: number;
  total_spent: number;
  alert_sent: boolean;
  alert_sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class BudgetRepository {
  static async getOrCreateBudgetTracking(
    userId: string,
    month: number,
    year: number,
    budgetLimit: number
  ): Promise<BudgetTracking> {
    // Try to get existing
    const existingResult = await query(
      `SELECT * FROM budget_tracking 
       WHERE user_id = $1 AND month = $2 AND year = $3`,
      [userId, month, year]
    );

    if (existingResult.rows.length > 0) {
      return existingResult.rows[0];
    }

    // Create new
    const result = await query(
      `INSERT INTO budget_tracking (user_id, month, year, budget_limit)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, month, year, budgetLimit]
    );

    return result.rows[0];
  }

  static async updateBudgetTracking(
    userId: string,
    month: number,
    year: number,
    data: Partial<{
      budgetLimit: number;
      totalSpent: number;
      alertSent: boolean;
    }>
  ): Promise<BudgetTracking | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.budgetLimit !== undefined) {
      updates.push(`budget_limit = $${paramIndex++}`);
      values.push(data.budgetLimit);
    }

    if (data.totalSpent !== undefined) {
      updates.push(`total_spent = $${paramIndex++}`);
      values.push(data.totalSpent);
    }

    if (data.alertSent !== undefined) {
      updates.push(`alert_sent = $${paramIndex++}`);
      values.push(data.alertSent);
      if (data.alertSent) {
        updates.push(`alert_sent_at = NOW()`);
      }
    }

    if (updates.length === 0) return null;

    updates.push(`updated_at = NOW()`);
    values.push(userId, month, year);

    const result = await query(
      `UPDATE budget_tracking 
       SET ${updates.join(', ')}
       WHERE user_id = $${paramIndex++} AND month = $${paramIndex++} AND year = $${paramIndex++}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  static async getCurrentMonthSpending(
    userId: string,
    month: number,
    year: number
  ): Promise<number> {
    const result = await query(
      `SELECT COALESCE(SUM(amount), 0) as spent
       FROM transactions
       WHERE user_id = $1
         AND EXTRACT(MONTH FROM transaction_date) = $2
         AND EXTRACT(YEAR FROM transaction_date) = $3
         AND transaction_type = 'debit'`,
      [userId, month, year]
    );

    return parseFloat(result.rows[0].spent);
  }

  static async getBudgetHistory(
    userId: string,
    limit: number = 12
  ): Promise<BudgetTracking[]> {
    const result = await query(
      `SELECT * FROM budget_tracking
       WHERE user_id = $1
       ORDER BY year DESC, month DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }
}
