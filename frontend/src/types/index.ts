// API types based on backend schema

export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  profilePicture?: string;
  monthlyBudget: number;
  isActive: boolean;
  preferences?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreditCard {
  id: string;
  userId: string;
  cardName: string;
  bankName: string;
  cardType?: string;
  lastFourDigits?: string;
  billDate: number;
  dueDate: number;
  creditLimit?: number;
  currentOutstanding: number;
  isActive: boolean;
  cardActivationDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  cardId: string;
  transactionDate: string;
  merchantName?: string;
  merchantCategory?: string;
  amount: number;
  transactionType: "debit" | "credit" | "refund";
  description?: string;
  billingCycleMonth?: number;
  billingCycleYear?: number;
  emailMessageId?: string;
  isManuallyAdded: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
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

export interface Alert {
  id: string;
  userId: string;
  alertType: string;
  priority: "low" | "medium" | "high";
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string;
  sentViaEmail: boolean;
  emailSentAt?: string;
  metadata?: Record<string, any>;
  expiresAt?: string;
  createdAt: string;
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
  details?: any;
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
