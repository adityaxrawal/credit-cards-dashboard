/**
 * Analytics and KPI Types
 * Types related to analytics, insights, and dashboard KPIs
 */

import type { Transaction } from './transaction';

/**
 * KPI data for dashboard overview
 */
export interface KPIData {
  totalBalance: number;
  cardCount: number;
  totalEarnings: number;
  totalSpendings: number;
  spendingGoal: number;
}

/**
 * Spending breakdown by category
 */
export interface SpendingByCategory {
  category: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

/**
 * Monthly spending data
 */
export interface MonthlySpending {
  month: string;
  totalSpent: number;
  cardBreakdown: {
    cardId: string;
    cardName: string;
    amount: number;
  }[];
}

/**
 * Dashboard statistics overview
 */
export interface DashboardStats {
  totalCards: number;
  activeCards: number;
  currentMonthSpending: number;
  budgetUtilization: number;
  upcomingBills: {
    cardId: string;
    cardName: string;
    billDate: number;
    dueDate: number;
    daysUntilBill: number;
    estimatedAmount: number;
  }[];
  recentTransactions: Transaction[];
}
