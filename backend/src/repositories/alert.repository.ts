import { query } from '../lib/db';

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

export class AlertRepository {
  static async createAlert(
    userId: string,
    type: string,
    data: {
      title: string;
      message: string;
      priority?: string;
      metadata?: any;
    }
  ): Promise<Alert> {
    const result = await query(
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
    return result.rows[0];
  }

  static async getUserAlerts(
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
    const countResult = await query(
      `SELECT COUNT(*) as total FROM alerts WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get paginated data
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const dataResult = await query(
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

  static async markAlertAsRead(userId: string, alertId: string): Promise<boolean> {
    const result = await query(
      `UPDATE alerts SET is_read = true WHERE id = $1 AND user_id = $2`,
      [alertId, userId]
    );
    return (result.rowCount || 0) > 0;
  }

  static async deleteAlert(userId: string, alertId: string): Promise<boolean> {
    const result = await query(
      `DELETE FROM alerts WHERE id = $1 AND user_id = $2`,
      [alertId, userId]
    );
    return (result.rowCount || 0) > 0;
  }

  static async markAlertSentViaEmail(alertId: string): Promise<boolean> {
    const result = await query(
      `UPDATE alerts SET sent_via_email = true WHERE id = $1`,
      [alertId]
    );
    return (result.rowCount || 0) > 0;
  }
}
