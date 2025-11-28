import * as alertsQueries from '../db/queries/alerts.queries';
import * as emailClient from '../lib/emailClient';
import pool from '../lib/db';

/**
 * Create an alert
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
) {
  return await alertsQueries.createAlert(userId, type, data);
}

/**
 * Create budget alert and optionally send email
 */
export async function createBudgetAlert(
  userId: string,
  budgetData: {
    month: number;
    year: number;
    monthlyBudget: number;
    spent: number;
    status: string;
  }
) {
  const percentage = ((budgetData.spent / budgetData.monthlyBudget) * 100).toFixed(1);
  
  const alert = await createAlert(userId, 'budget_exceeded', {
    title: `Budget Alert: ${percentage}% used`,
    message: `Your spending for ${budgetData.month}/${budgetData.year} has reached ${percentage}% of your monthly budget.`,
    priority: budgetData.status === 'exceeded' ? 'high' : 'medium',
    metadata: budgetData,
  });
  
  // Check if user has email alerts enabled
  const userResult = await pool.query(
    'SELECT email FROM users WHERE id = $1',
    [userId]
  );
  
  if (userResult.rows.length > 0) {
    const userEmail = userResult.rows[0].email;
    const emailSent = await emailClient.sendBudgetAlert(userEmail, budgetData);
    
    if (emailSent) {
      await alertsQueries.markAlertSentViaEmail(alert.id);
    }
  }
  
  return alert;
}

/**
 * Create bill reminder alert
 */
export async function createBillReminder(
  userId: string,
  cardData: {
    cardName: string;
    billDate: Date;
    dueDate: Date;
    amount?: number;
  }
) {
  const alert = await createAlert(userId, 'bill_reminder', {
    title: `Bill Reminder: ${cardData.cardName}`,
    message: `Your credit card bill is due on ${cardData.dueDate.toLocaleDateString()}`,
    priority: 'medium',
    metadata: cardData,
  });
  
  // Send email
  const userResult = await pool.query(
    'SELECT email FROM users WHERE id = $1',
    [userId]
  );
  
  if (userResult.rows.length > 0) {
    const userEmail = userResult.rows[0].email;
    const emailSent = await emailClient.sendBillReminder(userEmail, cardData);
    
    if (emailSent) {
      await alertsQueries.markAlertSentViaEmail(alert.id);
    }
  }
  
  return alert;
}

/**
 * Get user alerts
 */
export async function getUserAlerts(
  userId: string,
  filters?: {
    unreadOnly?: boolean;
    type?: string;
    page?: number;
    limit?: number;
  }
) {
  const page = filters?.page || 1;
  const limit = filters?.limit || 50;
  const offset = (page - 1) * limit;
  
  const result = await alertsQueries.getUserAlerts(userId, {
    unreadOnly: filters?.unreadOnly,
    type: filters?.type,
    limit,
    offset,
  });
  
  return {
    data: result.data,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
  };
}

/**
 * Mark alert as read
 */
export async function markAlertAsRead(userId: string, alertId: string) {
  return await alertsQueries.markAlertAsRead(userId, alertId);
}

/**
 * Delete alert
 */
export async function deleteAlert(userId: string, alertId: string) {
  return await alertsQueries.deleteAlert(userId, alertId);
}
