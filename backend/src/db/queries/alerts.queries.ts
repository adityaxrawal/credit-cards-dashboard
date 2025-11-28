import pool from '../index';

export interface Alert {
  id: string;
  user_id: string;
  alert_type: string;
  priority: string;
  title: string;
  message: string;
  is_read: boolean;
  sent_via_email: boolean;
  metadata: any;
  created_at: Date;
}

/**
 * Create a new alert
 */
export async function createAlert(
  userId: string,
  type: string,
  data: {
    title: string;
    message: string;
    priority?: string;
    metadata?: any;
  }
): Promise<Alert> {
  const { rows } = await pool.query(
    `INSERT INTO alerts (user_id, alert_type, title, message, priority, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      userId,
      type,
      data.title,
      data.message,
      data.priority || 'medium',
      data.metadata || null,
    ]
  );

  return rows[0];
}

/**
 * Get alerts for a user
 */
export async function getUserAlerts(
  userId: string,
  filters?: {
    unreadOnly?: boolean;
    type?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: Alert[]; total: number }> {
  const where: string[] = ['user_id = $1'];
  const params: any[] = [userId];
  let paramIndex = 2;

  if (filters?.unreadOnly) {
    where.push(`is_read = false`);
  }

  if (filters?.type) {
    where.push(`alert_type = $${paramIndex++}`);
    params.push(filters.type);
  }

  const whereClause = where.join(' AND ');

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM alerts WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total);

  // Get paginated data
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  const dataResult = await pool.query(
    `SELECT * FROM alerts 
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  return {
    data: dataResult.rows,
    total,
  };
}

/**
 * Mark alert as read
 */
export async function markAlertAsRead(
  userId: string,
  alertId: string
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE alerts SET is_read = true WHERE id = $1 AND user_id = $2`,
    [alertId, userId]
  );

  return (rowCount || 0) > 0;
}

/**
 * Delete an alert
 */
export async function deleteAlert(userId: string, alertId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM alerts WHERE id = $1 AND user_id = $2`,
    [alertId, userId]
  );

  return (rowCount || 0) > 0;
}

/**
 * Mark alert as sent via email
 */
export async function markAlertSentViaEmail(alertId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE alerts SET sent_via_email = true WHERE id = $1`,
    [alertId]
  );

  return (rowCount || 0) > 0;
}
