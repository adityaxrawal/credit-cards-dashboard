/**
 * Credit Card Types
 * Types related to credit card management and operations
 */

/**
 * Credit card entity
 */
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

/**
 * Form data for creating/updating a credit card
 */
export interface CardFormData {
  card_name: string;
  bank_name?: string;
  card_number_last4: string;
  bill_date: number;
  due_date: number;
  credit_limit?: number;
}

/**
 * Request payload for creating a new card
 */
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

/**
 * Card insights and analytics
 */
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
