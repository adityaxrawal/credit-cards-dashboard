import pool from '../../lib/db';

export interface AnalyticsCache {
  id: string;
  user_id: string;
  metric_key: string;
  metric_value: any;
  period_start: Date | null;
  period_end: Date | null;
  computed_at: Date;
  expires_at: Date | null;
}

/**
 * Get cached analytics
 */
export async function getCachedAnalytics(
  userId: string,
  metricKey: string,
  periodStart?: Date,
  periodEnd?: Date
): Promise<any | null> {
  const where: string[] = ['user_id = $1', 'metric_key = $2'];
  const params: any[] = [userId, metricKey];
  let paramIndex = 3;

  if (periodStart) {
    where.push(`period_start = $${paramIndex++}`);
    params.push(periodStart);
  }

  if (periodEnd) {
    where.push(`period_end = $${paramIndex++}`);
    params.push(periodEnd);
  }

  // Check if not expired
  where.push(`(expires_at IS NULL OR expires_at > NOW())`);

  const { rows } = await pool.query(
    `SELECT metric_value FROM analytics_cache 
     WHERE ${where.join(' AND ')}
     ORDER BY computed_at DESC
     LIMIT 1`,
    params
  );

  return rows[0]?.metric_value || null;
}

/**
 * Set cached analytics
 */
export async function setCachedAnalytics(
  userId: string,
  metricKey: string,
  metricValue: any,
  periodStart?: Date,
  periodEnd?: Date,
  expiresAt?: Date
): Promise<void> {
  await pool.query(
    `INSERT INTO analytics_cache (
      user_id, metric_key, metric_value, period_start, period_end, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (user_id, metric_key, period_start, period_end)
    DO UPDATE SET 
      metric_value = EXCLUDED.metric_value,
      computed_at = NOW(),
      expires_at = EXCLUDED.expires_at`,
    [
      userId,
      metricKey,
      JSON.stringify(metricValue),
      periodStart || null,
      periodEnd || null,
      expiresAt || null,
    ]
  );
}

/**
 * Invalidate cached analytics
 */
export async function invalidateCachedAnalytics(
  userId: string,
  metricKeyPattern?: string
): Promise<void> {
  if (metricKeyPattern) {
    await pool.query(
      `DELETE FROM analytics_cache 
       WHERE user_id = $1 AND metric_key LIKE $2`,
      [userId, metricKeyPattern]
    );
  } else {
    await pool.query(
      `DELETE FROM analytics_cache WHERE user_id = $1`,
      [userId]
    );
  }
}

/**
 * Get Monthly Category Spend (Pivot equivalent)
 * Returns: { month: '2023-01', category: 'Food', total: 5000 }
 */
export async function getMonthlyCategorySpend(
  userId: string,
  year: number
): Promise<Array<{ month: string; category: string; total: number }>> {
  const { rows } = await pool.query(
    `SELECT 
       TO_CHAR(transaction_date, 'YYYY-MM') as month,
       category,
       SUM(amount) as total
     FROM transactions
     WHERE user_id = $1 
       AND EXTRACT(YEAR FROM transaction_date) = $2
       AND direction = 'debit'
       AND is_settled = true
     GROUP BY month, category
     ORDER BY month ASC, total DESC`,
    [userId, year]
  );

  return rows.map(row => ({
    month: row.month,
    category: row.category,
    total: parseFloat(row.total)
  }));
}

/**
 * Get Merchant Statistics
 * Returns top merchants by spend and frequency
 */
export async function getMerchantStats(
  userId: string,
  limit: number = 20,
  startDate?: Date,
  endDate?: Date
): Promise<Array<{ merchant: string; total_spend: number; transaction_count: number; avg_spend: number }>> {
  const where: string[] = ['user_id = $1', "direction = 'debit'", 'is_settled = true'];
  const params: any[] = [userId, limit];
  let paramIndex = 3;

  if (startDate) {
    where.push(`transaction_date >= $${paramIndex++}`);
    params.push(startDate);
  }

  if (endDate) {
    where.push(`transaction_date <= $${paramIndex++}`);
    params.push(endDate);
  }

  const { rows } = await pool.query(
    `SELECT 
       merchant,
       SUM(amount) as total_spend,
       COUNT(*) as transaction_count,
       AVG(amount) as avg_spend
     FROM transactions
     WHERE ${where.join(' AND ')}
     GROUP BY merchant
     ORDER BY total_spend DESC
     LIMIT $2`,
    params
  );

  return rows.map(row => ({
    merchant: row.merchant,
    total_spend: parseFloat(row.total_spend),
    transaction_count: parseInt(row.transaction_count),
    avg_spend: parseFloat(row.avg_spend)
  }));
}

/**
 * Get Daily Spend Trends
 */
export async function getDailyTrends(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: string; total: number; count: number }>> {
  const { rows } = await pool.query(
    `SELECT 
       TO_CHAR(transaction_date, 'YYYY-MM-DD') as date,
       SUM(amount) as total,
       COUNT(*) as count
     FROM transactions
     WHERE user_id = $1 
       AND transaction_date >= $2
       AND transaction_date <= $3
       AND direction = 'debit'
       AND is_settled = true
     GROUP BY date
     ORDER BY date ASC`,
    [userId, startDate, endDate]
  );

  return rows.map(row => ({
    date: row.date,
    total: parseFloat(row.total),
    count: parseInt(row.count)
  }));
}
