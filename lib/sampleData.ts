import sampleDataJson from '@/data/sampleData.json';

// Type definitions based on the database schema
export interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface CreditCard {
  id: string;
  profile_id: string;
  bank_name: string;
  card_last_4: string;
  card_holder_name: string;
  card_type: string;
  credit_limit: number;
  available_credit: number;
  reward_points: number;
  statement_date: number;
  due_date: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  card_id: string;
  amount: number;
  description: string;
  merchant: string;
  category: string;
  transaction_date: string;
  status: string;
  reward_points_earned: number;
  created_at: string;
}

export interface Statement {
  id: string;
  card_id: string;
  statement_date: string;
  due_date: string;
  total_amount: number;
  minimum_amount: number;
  previous_balance: number;
  payments_credits: number;
  purchases: number;
  fees_interest: number;
  reward_points_earned: number;
  status: string;
  created_at: string;
}

export interface StatementTransaction {
  id: string;
  statement_id: string;
  amount: number;
  description: string;
  merchant: string;
  category: string;
  transaction_date: string;
  reward_points_earned: number;
}

export interface CardPerk {
  id: string;
  card_id: string;
  perk_type: string;
  category: string;
  reward_rate: number;
  description: string;
  max_monthly_benefit: number | null;
  is_active: boolean;
}

export interface SpendingLimit {
  id: string;
  card_id: string;
  category: string;
  monthly_limit: number;
  current_spent: number;
  alert_threshold: number;
  is_active: boolean;
  created_at: string;
}

export interface DashboardSummary {
  totalCreditLimit: number;
  totalAvailableCredit: number;
  totalCurrentDue: number;
  totalRewardPoints: number;
  upcomingDueDates: Array<{
    card_id: string;
    bank_name: string;
    due_amount: number;
    due_date: string;
    days_remaining: number;
    status: string;
  }>;
  monthlySpending: {
    current_month: number;
    previous_month: number;
    change_percentage: number;
  };
  categoryWiseSpending: Array<{
    category: string;
    amount: number;
    percentage: number;
    transactions: number;
  }>;
  recentActivity: Array<{
    type: string;
    description: string;
    amount: number;
    card: string;
    timestamp: string;
  }>;
}

export interface SampleData {
  profile: Profile;
  creditCards: CreditCard[];
  currentTransactions: Transaction[];
  statements: Statement[];
  statementTransactions: StatementTransaction[];
  cardPerks: CardPerk[];
  spendingLimits: SpendingLimit[];
  dashboardSummary: DashboardSummary;
}

// Sample data with proper typing
export const sampleData: SampleData = sampleDataJson as SampleData;

// Utility functions to work with sample data
export const getSampleCreditCards = (): CreditCard[] => {
  return sampleData.creditCards;
};

export const getSampleTransactions = (cardId?: string): Transaction[] => {
  if (cardId) {
    return sampleData.currentTransactions.filter(txn => txn.card_id === cardId);
  }
  return sampleData.currentTransactions;
};

export const getSampleStatements = (cardId?: string): Statement[] => {
  if (cardId) {
    return sampleData.statements.filter(stmt => stmt.card_id === cardId);
  }
  return sampleData.statements;
};

export const getSampleCardPerks = (cardId?: string): CardPerk[] => {
  if (cardId) {
    return sampleData.cardPerks.filter(perk => perk.card_id === cardId);
  }
  return sampleData.cardPerks;
};

export const getSampleSpendingLimits = (cardId?: string): SpendingLimit[] => {
  if (cardId) {
    return sampleData.spendingLimits.filter(limit => limit.card_id === cardId);
  }
  return sampleData.spendingLimits;
};

export const getSampleDashboardSummary = (): DashboardSummary => {
  return sampleData.dashboardSummary;
};

export const getSampleProfile = (): Profile => {
  return sampleData.profile;
};

// Helper functions for dashboard calculations
export const calculateTotalCreditUtilization = (): number => {
  const totalLimit = sampleData.creditCards.reduce((sum, card) => sum + card.credit_limit, 0);
  const totalUsed = sampleData.creditCards.reduce((sum, card) => sum + (card.credit_limit - card.available_credit), 0);
  return totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0;
};

export const getCardWithHighestDue = (): { card: CreditCard; dueAmount: number } | null => {
  const dueDates = sampleData.dashboardSummary.upcomingDueDates;
  if (dueDates.length === 0) return null;
  
  const highestDue = dueDates.reduce((max, current) => 
    current.due_amount > max.due_amount ? current : max
  );
  
  const card = sampleData.creditCards.find(c => c.id === highestDue.card_id);
  return card ? { card, dueAmount: highestDue.due_amount } : null;
};

export const getTopSpendingCategory = (): { category: string; amount: number; percentage: number } | null => {
  const categories = sampleData.dashboardSummary.categoryWiseSpending;
  if (categories.length === 0) return null;
  
  return categories.reduce((max, current) => 
    current.amount > max.amount ? current : max
  );
};

export const getRecentTransactions = (limit: number = 5): Transaction[] => {
  return sampleData.currentTransactions
    .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
    .slice(0, limit);
};

export const getOverdueCards = (): Array<{ card: CreditCard; dueAmount: number; daysOverdue: number }> => {
  return sampleData.dashboardSummary.upcomingDueDates
    .filter(due => due.status === 'overdue')
    .map(due => {
      const card = sampleData.creditCards.find(c => c.id === due.card_id);
      return card ? {
        card,
        dueAmount: due.due_amount,
        daysOverdue: Math.abs(due.days_remaining)
      } : null;
    })
    .filter(Boolean) as Array<{ card: CreditCard; dueAmount: number; daysOverdue: number }>;
};