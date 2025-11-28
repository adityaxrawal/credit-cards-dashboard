/**
 * Budget and Spending Limit Types
 * Types related to budget tracking and spending limits
 */

/**
 * Budget tracking entity for a specific month/year
 */
export interface BudgetTracking {
  id: string;
  userId: string;
  month: number;
  year: number;
  budgetLimit: number;
  totalSpent: number;
  alertSent: boolean;
  alertSentAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Spending limit configuration
 */
export interface SpendingLimit {
  id: string;
  monthly_limit: number;
  alert_threshold: number;
  is_active: boolean;
  daily_limit?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Form data for setting/updating spending limits
 */
export interface SpendingLimitFormData {
  monthly_limit: number;
  alert_threshold: number;
  is_active: boolean;
  daily_limit?: number;
}

/**
 * Request payload for updating monthly budget
 */
export interface UpdateBudgetRequest {
  monthlyBudget: number;
}
