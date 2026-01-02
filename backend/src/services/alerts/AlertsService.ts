import { EmailService } from '../notifications/EmailService';
import { AlertRepository } from '../../repositories/AlertRepository';
import { invalidateAlertCache } from '../../utils/cache/cacheInvalidation';

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
    metadata?: Record<string, unknown>;
  }
) {
  const alert = await AlertRepository.create(userId, type, data);
  if (alert) {
    await invalidateAlertCache(userId);
  }
  return alert;
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
  const userEmail = await AlertRepository.getUserEmail(userId);

  if (userEmail) {
    const emailSent = await EmailService.sendBudgetAlert(userEmail, budgetData);

    if (emailSent) {
      await AlertRepository.markSentViaEmail(alert.id);
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
  const userEmail = await AlertRepository.getUserEmail(userId);

  if (userEmail) {
    const emailSent = await EmailService.sendBillReminder(userEmail, cardData);

    if (emailSent) {
      await AlertRepository.markSentViaEmail(alert.id);
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

  const result = await AlertRepository.findByUserId(userId, {
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
  const result = await AlertRepository.markAsRead(userId, alertId);
  if (result) {
    await invalidateAlertCache(userId);
  }
  return result;
}

/**
 * Delete alert
 */
export async function deleteAlert(userId: string, alertId: string) {
  const result = await AlertRepository.delete(userId, alertId);
  if (result) {
    await invalidateAlertCache(userId);
  }
  return result;
}
