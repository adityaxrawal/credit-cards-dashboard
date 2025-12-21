import pool from '../../lib/db';
import * as budgetQueries from '../../db/queries/budget.queries';
import { invalidateBudgetCache } from '../../utils/cache/cacheInvalidation';
import dayjs from 'dayjs';

/**
 * Get current budget status
 */
export async function getCurrentBudgetStatus(userId: string) {
  const now = dayjs();
  const month = now.month() + 1;
  const year = now.year();

  // Get user's monthly budget
  const userResult = await pool.query(
    'SELECT monthly_budget FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }

  const monthlyBudget = parseFloat(userResult.rows[0].monthly_budget || '30000');

  // Get current month spending
  const spent = await budgetQueries.getCurrentMonthSpending(userId, month, year);

  const ratio = spent / monthlyBudget;

  const status =
    ratio >= 1
      ? 'exceeded'
      : ratio >= 0.9
        ? 'critical'
        : ratio >= 0.6
          ? 'warning'
          : 'safe';

  // Get or create budget tracking record
  await budgetQueries.getOrCreateBudgetTracking(userId, month, year, monthlyBudget);

  // Update spending
  await budgetQueries.updateBudgetTracking(userId, month, year, {
    totalSpent: spent,
  });

  return {
    month,
    year,
    monthlyBudget,
    spent,
    remaining: monthlyBudget - spent,
    ratio,
    status,
  };
}

/**
 * Update monthly budget
 */
export async function updateMonthlyBudget(userId: string, newBudget: number) {
  await pool.query(
    'UPDATE users SET monthly_budget = $1, updated_at = NOW() WHERE id = $2',
    [newBudget, userId]
  );

  await invalidateBudgetCache(userId);
  return { monthlyBudget: newBudget };
}

/**
 * Get budget history
 */
export async function getBudgetHistory(userId: string, limit: number = 12) {
  const history = await budgetQueries.getBudgetHistory(userId, limit);

  return history.map(record => ({
    month: record.month,
    year: record.year,
    budgetLimit: parseFloat(record.budget_limit.toString()),
    totalSpent: parseFloat(record.total_spent.toString()),
    percentage: (parseFloat(record.total_spent.toString()) / parseFloat(record.budget_limit.toString())) * 100,
    alertSent: record.alert_sent,
  }));
}

/**
 * Mark alert as sent
 */
export async function markAlertSent(userId: string, month: number, year: number) {
  await budgetQueries.updateBudgetTracking(userId, month, year, {
    alertSent: true,
  });
}
