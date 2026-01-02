import { BudgetRepository } from '../../repositories/BudgetRepository';
import { TransactionRepository } from '../../repositories/TransactionRepository';
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
  const monthlyBudget = await BudgetRepository.getUserMonthlyBudget(userId);

  // Get current month spending
  const spent = await TransactionRepository.getCurrentMonthSpending(userId, month, year);

  const ratio = (monthlyBudget > 0) ? (spent / monthlyBudget) : 0;

  const status =
    ratio >= 1
      ? 'exceeded'
      : ratio >= 0.9
        ? 'critical'
        : ratio >= 0.6
          ? 'warning'
          : 'safe';

  // Get or create budget tracking record
  await BudgetRepository.getOrCreateBudgetTracking(userId, month, year, monthlyBudget);

  // Update spending
  await BudgetRepository.updateBudgetTracking(userId, month, year, {
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
  await BudgetRepository.updateUserMonthlyBudget(userId, newBudget);
  await invalidateBudgetCache(userId);
  return { monthlyBudget: newBudget };
}

/**
 * Get budget history
 */
export async function getBudgetHistory(userId: string, limit: number = 12) {
  const history = await BudgetRepository.getHistory(userId, limit);

  return history.map(record => ({
    month: record.month,
    year: record.year,
    budgetLimit: parseFloat(record.budget_limit.toString()),
    totalSpent: parseFloat(record.total_spent.toString()),
    percentage: (parseFloat(record.total_spent.toString()) / parseFloat(record.budget_limit.toString())) * 100,
    alertSent: record.alert_sent,
  }));
}


export async function markAlertSent(userId: string, month: number, year: number) {
  await BudgetRepository.updateBudgetTracking(userId, month, year, {
    alertSent: true,
  });
}

/**
 * Link Savings Goal to Budget
 * (Simple implementation: Stores goal ID in user settings or rules)
 */
export async function linkBudgetToSavings(userId: string, categoryId: string, goalId: string) {
  await BudgetRepository.createBudgetRule(
    userId,
    'Savings Link',
    'SAVINGS_LINK',
    { categoryId, goalId }
  );
  return true;
}

/**
 * Get active budget alerts
 */
export async function getBudgetAlerts(userId: string) {
  const status = await getCurrentBudgetStatus(userId);
  const alerts: string[] = [];

  if (status.ratio >= 1.0) {
    alerts.push(`You have exceeded your monthly budget by ₹${status.spent - status.monthlyBudget}`);
  } else if (status.ratio >= 0.9) {
    alerts.push(`Warning: You have used ${Math.round(status.ratio * 100)}% of your budget.`);
  }

  return alerts;
}


// --- VSCODE-SPECIFIC EXPORTS FOR NEW SERVICES ---
import { EnvelopeBudgetingService } from './EnvelopeBudgeting';
import { BudgetRulesService } from './BudgetRulesService';

export async function getCategoryBudgets(userId: string, month: number, year: number) {
  return EnvelopeBudgetingService.getEnvelopes(userId, month, year);
}

export async function setCategoryBudget(userId: string, categoryId: string, amount: number) {
  const now = dayjs();
  // Default to current month if not specified, but typically UI passes it. 
  // For this signature let's assume current month or explicit params needed.
  // Actually, better to take month/year as params.
  // We'll update the signature to match common usage.
  return EnvelopeBudgetingService.setEnvelope(userId, now.month() + 1, now.year(), categoryId, amount);
}

export async function setCategoryBudgetForMonth(userId: string, categoryId: string, amount: number, month: number, year: number) {
  return EnvelopeBudgetingService.setEnvelope(userId, month, year, categoryId, amount);
}

export async function getRolloverStatus(userId: string) {
  return BudgetRulesService.isRolloverEnabled(userId);
}

export async function setRolloverRule(userId: string, enabled: boolean) {
  return BudgetRulesService.setRolloverRule(userId, enabled);
}
