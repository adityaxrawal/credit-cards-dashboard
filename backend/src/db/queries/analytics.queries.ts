import pool from '../index';

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
