import { 
  sampleData,
  Profile,
  CreditCard,
  Transaction,
  Statement,
  StatementTransaction,
  CardPerk,
  SpendingLimit,
  DashboardSummary,
  SampleData
} from '@/data/mockData';

// Re-export types for backward compatibility
export type {
  Profile,
  CreditCard,
  Transaction,
  Statement,
  StatementTransaction,
  CardPerk,
  SpendingLimit,
  DashboardSummary,
  SampleData
};

// Re-export the sample data
export { sampleData };

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

export const calculateCardUtilization = (cardId: string): number => {
  const card = sampleData.creditCards.find(c => c.id === cardId);
  if (!card) return 0;
  
  const used = card.credit_limit - card.available_credit;
  return card.credit_limit > 0 ? (used / card.credit_limit) * 100 : 0;
};

export const getTotalRewardPoints = (): number => {
  return sampleData.creditCards.reduce((sum, card) => sum + card.reward_points, 0);
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