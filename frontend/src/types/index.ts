// API types based on backend schema and frontend specification

export interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  created_at: string;
  updated_at: string;
}

export interface CreditCard {
  id: string;
  card_name: string;
  bank_name?: string;
  card_number_last4: string;
  bill_date: number;
  due_date: number;
  credit_limit?: number;
  current_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  amount: number;
  transaction_date: string;
  merchant: string;
  category?: string;
  card_id: string;
  description?: string;
  bill_month: number;
  bill_year: number;
  is_settled: boolean;
  created_at: string;
  updated_at: string;
  card?: CreditCard;
}

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

export interface SpendingLimit {
  id: string;
  monthly_limit: number;
  alert_threshold: number;
  is_active: boolean;
  daily_limit?: number;
  created_at: string;
  updated_at: string;
}

export interface EmailPreferences {
  id: string;
  email_notifications_enabled: boolean;
  spending_limit_alerts: boolean;
  bill_reminders: boolean;
  bill_reminder_days: number;
  unusual_transaction_alerts: boolean;
  weekly_summary: boolean;
  monthly_report: boolean;
  created_at: string;
  updated_at: string;
}

export interface GmailIntegration {
  connected: boolean;
  email?: string;
  last_sync?: string;
  auto_sync: boolean;
  sync_frequency: string;
}

export interface KPIData {
  totalBalance: number;
  cardCount: number;
  totalEarnings: number;
  totalSpendings: number;
  spendingGoal: number;
}

export interface TransactionStats {
  total: number;
  totalAmount: number;
  thisMonthTotal: number;
  averageAmount: number;
  largestTransaction?: Transaction;
  topCategory: string;
}

export interface CardInsights {
  spendingTrends: Array<{
    month: string;
    amount: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  monthlyComparison: Array<{
    month: string;
    current: number;
    previous: number;
  }>;
  averageTransaction: number;
  mostUsedCategory: string;
  peakSpendingDay: string;
}

export interface AlertHistory {
  id: string;
  type: "spending_limit" | "bill_reminder" | "unusual_transaction" | "system";
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TransactionFilters {
  month?: number;
  year?: number;
  card_id?: string;
  category?: string;
  type?: "revenue" | "expense";
  search?: string;
  min_amount?: number;
  max_amount?: number;
  start_date?: string;
  end_date?: string;
}

export interface CardFormData {
  card_name: string;
  bank_name?: string;
  card_number_last4: string;
  bill_date: number;
  due_date: number;
  credit_limit?: number;
}

export interface TransactionFormData {
  amount: number;
  transaction_date: string;
  merchant: string;
  category?: string;
  card_id: string;
  description?: string;
  bill_month: number;
  bill_year: number;
}

export interface SpendingLimitFormData {
  monthly_limit: number;
  alert_threshold: number;
  is_active: boolean;
  daily_limit?: number;
}

export type ModalSize = "sm" | "md" | "lg" | "xl";
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "error"
  | "info";
export type BadgeVariant = "success" | "warning" | "error" | "info" | "default";
export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    profilePicture?: string;
  };
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

// Request types
export interface CreateCardRequest {
  cardName: string;
  bankName: string;
  cardType?: string;
  lastFourDigits?: string;
  billDate: number;
  dueDate: number;
  creditLimit?: number;
  cardActivationDate?: string;
  notes?: string;
}

export interface CreateTransactionRequest {
  cardId: string;
  transactionDate: string;
  merchantName?: string;
  merchantCategory?: string;
  amount: number;
  transactionType?: "debit" | "credit" | "refund";
  description?: string;
}

export interface UpdateBudgetRequest {
  monthlyBudget: number;
}

// Analytics types
export interface SpendingByCategory {
  category: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface MonthlySpending {
  month: string;
  totalSpent: number;
  cardBreakdown: {
    cardId: string;
    cardName: string;
    amount: number;
  }[];
}

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
