import pool from '../../lib/db';

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

/**
 * Get or create budget tracking for a month
 */
export async function getOrCreateBudgetTracking(
  userId: string,
  month: number,
  year: number,
  budgetLimit: number
): Promise<BudgetTracking> {
  // Try to get existing
  const { rows: existing } = await pool.query(
    `SELECT * FROM budget_tracking 
     WHERE user_id = $1 AND month = $2 AND year = $3`,
    [userId, month, year]
  );

  if (existing.length > 0) {
    return existing[0];
  }

  // Create new
  const { rows } = await pool.query(
    `INSERT INTO budget_tracking (user_id, month, year, budget_limit)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, month, year, budgetLimit]
  );

  return rows[0];
}

/**
 * Update budget tracking
 */
export async function updateBudgetTracking(
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

  const { rows } = await pool.query(
    `UPDATE budget_tracking 
     SET ${updates.join(', ')}
     WHERE user_id = $${paramIndex++} AND month = $${paramIndex++} AND year = $${paramIndex++}
     RETURNING *`,
    values
  );

  return rows[0] || null;
}

/**
 * Get current month spending
 */
export async function getCurrentMonthSpending(
  userId: string,
  month: number,
  year: number
): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as spent
     FROM transactions
     WHERE user_id = $1
       AND EXTRACT(MONTH FROM transaction_date) = $2
       AND EXTRACT(YEAR FROM transaction_date) = $3
       AND transaction_type = 'debit'`,
    [userId, month, year]
  );

  return parseFloat(rows[0].spent);
}

/**
 * Get budget history
 */
export async function getBudgetHistory(
  userId: string,
  limit: number = 12
): Promise<BudgetTracking[]> {
  const { rows } = await pool.query(
    `SELECT * FROM budget_tracking
     WHERE user_id = $1
     ORDER BY year DESC, month DESC
     LIMIT $2`,
    [userId, limit]
  );

  return rows;
}
