// Original mock interfaces (kept for backward compatibility if needed)
export interface MockCard {
  id: string;
  bank_name: string;
  card_last_4: string;
  card_holder_name: string;
  card_type: string;
  credit_limit?: number;
  available_credit?: number;
  reward_points?: number;
}

export interface MockTransaction {
  id: string;
  merchant: string;
  amount: number;
  date: string;
  category: string;
  type: 'debit' | 'credit';
  status: 'completed' | 'pending' | 'failed';
}

// Comprehensive interfaces for the main sample data
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

// Main sample data (replaces the old sampleData.json content)
export const sampleData: SampleData = {
  profile: {
    id: "user_123",
    email: "aditya.rawal@example.com",
    name: "Aditya Rawal",
    phone: "+91-9876543210",
    created_at: "2024-01-15T10:30:00Z",
    updated_at: "2024-12-15T14:20:00Z"
  },
  creditCards: [
    {
      id: "card_001",
      profile_id: "user_123",
      bank_name: "HDFC Bank",
      card_last_4: "4567",
      card_holder_name: "ADITYA RAWAL",
      card_type: "Visa",
      credit_limit: 500000,
      available_credit: 325000,
      reward_points: 12450,
      statement_date: 15,
      due_date: 5,
      created_at: "2024-01-15T10:30:00Z",
      updated_at: "2024-12-15T14:20:00Z"
    },
    {
      id: "card_002",
      profile_id: "user_123",
      bank_name: "SBI",
      card_last_4: "8901",
      card_holder_name: "ADITYA RAWAL",
      card_type: "Mastercard",
      credit_limit: 300000,
      available_credit: 280000,
      reward_points: 5670,
      statement_date: 20,
      due_date: 10,
      created_at: "2024-03-10T09:15:00Z",
      updated_at: "2024-12-14T16:45:00Z"
    },
    {
      id: "card_003",
      profile_id: "user_123",
      bank_name: "ICICI Bank",
      card_last_4: "2345",
      card_holder_name: "ADITYA RAWAL",
      card_type: "RuPay",
      credit_limit: 200000,
      available_credit: 150000,
      reward_points: 3240,
      statement_date: 25,
      due_date: 15,
      created_at: "2024-06-20T11:00:00Z",
      updated_at: "2024-12-13T12:30:00Z"
    }
  ],
  currentTransactions: [
    {
      id: "txn_001",
      card_id: "card_001",
      amount: 2500.00,
      description: "Swiggy Order - Pizza Hut",
      merchant: "Swiggy",
      category: "Food & Dining",
      transaction_date: "2024-12-15T19:30:00Z",
      status: "completed",
      reward_points_earned: 25,
      created_at: "2024-12-15T19:30:00Z"
    },
    {
      id: "txn_002",
      card_id: "card_001",
      amount: 15000.00,
      description: "Amazon Purchase - Electronics",
      merchant: "Amazon India",
      category: "Shopping",
      transaction_date: "2024-12-14T14:20:00Z",
      status: "completed",
      reward_points_earned: 150,
      created_at: "2024-12-14T14:20:00Z"
    },
    {
      id: "txn_003",
      card_id: "card_002",
      amount: 8500.00,
      description: "Fuel - Indian Oil",
      merchant: "Indian Oil Corporation",
      category: "Gas",
      transaction_date: "2024-12-13T08:45:00Z",
      status: "completed",
      reward_points_earned: 85,
      created_at: "2024-12-13T08:45:00Z"
    },
    {
      id: "txn_004",
      card_id: "card_001",
      amount: 12000.00,
      description: "Grocery Shopping - Big Bazaar",
      merchant: "Big Bazaar",
      category: "Groceries",
      transaction_date: "2024-12-12T16:20:00Z",
      status: "completed",
      reward_points_earned: 120,
      created_at: "2024-12-12T16:20:00Z"
    },
    {
      id: "txn_005",
      card_id: "card_003",
      amount: 3500.00,
      description: "Movie Tickets - PVR Cinemas",
      merchant: "PVR Cinemas",
      category: "Entertainment",
      transaction_date: "2024-12-11T20:15:00Z",
      status: "completed",
      reward_points_earned: 35,
      created_at: "2024-12-11T20:15:00Z"
    },
    {
      id: "txn_006",
      card_id: "card_002",
      amount: 7800.00,
      description: "Medical Expenses - Apollo Hospital",
      merchant: "Apollo Hospital",
      category: "Healthcare",
      transaction_date: "2024-12-10T11:30:00Z",
      status: "completed",
      reward_points_earned: 78,
      created_at: "2024-12-10T11:30:00Z"
    },
    {
      id: "txn_007",
      card_id: "card_001",
      amount: 5200.00,
      description: "Online Course - Udemy",
      merchant: "Udemy",
      category: "Education",
      transaction_date: "2024-12-09T14:45:00Z",
      status: "completed",
      reward_points_earned: 52,
      created_at: "2024-12-09T14:45:00Z"
    },
    {
      id: "txn_008",
      card_id: "card_003",
      amount: 4500.00,
      description: "Clothing Purchase - Zara",
      merchant: "Zara",
      category: "Shopping",
      transaction_date: "2024-12-08T18:00:00Z",
      status: "completed",
      reward_points_earned: 45,
      created_at: "2024-12-08T18:00:00Z"
    },
    {
      id: "txn_009",
      card_id: "card_002",
      amount: 6200.00,
      description: "Restaurant Bill - The Oberoi",
      merchant: "The Oberoi",
      category: "Food & Dining",
      transaction_date: "2024-12-07T21:30:00Z",
      status: "completed",
      reward_points_earned: 62,
      created_at: "2024-12-07T21:30:00Z"
    },
    {
      id: "txn_010",
      card_id: "card_001",
      amount: 9800.00,
      description: "Flight Booking - IndiGo",
      merchant: "IndiGo Airlines",
      category: "Travel",
      transaction_date: "2024-12-06T10:15:00Z",
      status: "completed",
      reward_points_earned: 98,
      created_at: "2024-12-06T10:15:00Z"
    }
  ],
  statements: [
    {
      id: "stmt_001",
      card_id: "card_001",
      statement_date: "2024-11-15T00:00:00Z",
      due_date: "2024-12-05T23:59:59Z",
      total_amount: 45000.00,
      minimum_amount: 4500.00,
      previous_balance: 12000.00,
      payments_credits: 12000.00,
      purchases: 43500.00,
      fees_interest: 1500.00,
      reward_points_earned: 435,
      status: "generated",
      created_at: "2024-11-15T00:00:00Z"
    },
    {
      id: "stmt_002",
      card_id: "card_002",
      statement_date: "2024-11-20T00:00:00Z",
      due_date: "2024-12-10T23:59:59Z",
      total_amount: 18500.00,
      minimum_amount: 1850.00,
      previous_balance: 5000.00,
      payments_credits: 5000.00,
      purchases: 17800.00,
      fees_interest: 700.00,
      reward_points_earned: 178,
      status: "generated",
      created_at: "2024-11-20T00:00:00Z"
    },
    {
      id: "stmt_003",
      card_id: "card_003",
      statement_date: "2024-11-25T00:00:00Z",
      due_date: "2024-12-15T23:59:59Z",
      total_amount: 8000.00,
      minimum_amount: 800.00,
      previous_balance: 2000.00,
      payments_credits: 2000.00,
      purchases: 7500.00,
      fees_interest: 500.00,
      reward_points_earned: 75,
      status: "generated",
      created_at: "2024-11-25T00:00:00Z"
    }
  ],
  statementTransactions: [
    {
      id: "stmt_txn_001",
      statement_id: "stmt_001",
      amount: 15000.00,
      description: "Flipkart Purchase - Mobile Phone",
      merchant: "Flipkart",
      category: "Electronics",
      transaction_date: "2024-11-02T10:30:00Z",
      reward_points_earned: 150
    },
    {
      id: "stmt_txn_002",
      statement_id: "stmt_001",
      amount: 8500.00,
      description: "Petrol - HP Gas Station",
      merchant: "HP Petrol Pump",
      category: "Gas",
      transaction_date: "2024-11-05T08:15:00Z",
      reward_points_earned: 85
    },
    {
      id: "stmt_txn_003",
      statement_id: "stmt_002",
      amount: 4200.00,
      description: "Grocery - Reliance Fresh",
      merchant: "Reliance Fresh",
      category: "Groceries",
      transaction_date: "2024-11-08T17:45:00Z",
      reward_points_earned: 42
    }
  ],
  cardPerks: [
    {
      id: "perk_001",
      card_id: "card_001",
      perk_type: "cashback",
      category: "Dining",
      reward_rate: 5.0,
      description: "5% cashback on dining transactions",
      max_monthly_benefit: 1000.00,
      is_active: true
    },
    {
      id: "perk_002",
      card_id: "card_001",
      perk_type: "reward_points",
      category: "Shopping",
      reward_rate: 2.0,
      description: "2 reward points per ₹100 spent on shopping",
      max_monthly_benefit: null,
      is_active: true
    },
    {
      id: "perk_003",
      card_id: "card_002",
      perk_type: "cashback",
      category: "Fuel",
      reward_rate: 4.0,
      description: "4% cashback on fuel transactions",
      max_monthly_benefit: 500.00,
      is_active: true
    },
    {
      id: "perk_004",
      card_id: "card_003",
      perk_type: "reward_points",
      category: "Entertainment",
      reward_rate: 3.0,
      description: "3 reward points per ₹100 spent on entertainment",
      max_monthly_benefit: 750.00,
      is_active: true
    }
  ],
  spendingLimits: [
    {
      id: "limit_001",
      card_id: "card_001",
      category: "Entertainment",
      monthly_limit: 10000.00,
      current_spent: 3500.00,
      alert_threshold: 80.0,
      is_active: true,
      created_at: "2024-01-15T10:30:00Z"
    },
    {
      id: "limit_002",
      card_id: "card_001",
      category: "Shopping",
      monthly_limit: 25000.00,
      current_spent: 19500.00,
      alert_threshold: 75.0,
      is_active: true,
      created_at: "2024-01-15T10:30:00Z"
    },
    {
      id: "limit_003",
      card_id: "card_002",
      category: "Fuel",
      monthly_limit: 15000.00,
      current_spent: 8500.00,
      alert_threshold: 85.0,
      is_active: true,
      created_at: "2024-03-10T09:15:00Z"
    }
  ],
  dashboardSummary: {
    totalCreditLimit: 1000000,
    totalAvailableCredit: 755000,
    totalCurrentDue: 63500.00,
    totalRewardPoints: 21360,
    upcomingDueDates: [
      {
        card_id: "card_001",
        bank_name: "HDFC Bank",
        due_amount: 45000.00,
        due_date: "2024-12-05T23:59:59Z",
        days_remaining: -10,
        status: "overdue"
      },
      {
        card_id: "card_002",
        bank_name: "SBI",
        due_amount: 18500.00,
        due_date: "2024-12-10T23:59:59Z",
        days_remaining: -5,
        status: "overdue"
      },
      {
        card_id: "card_003",
        bank_name: "ICICI Bank",
        due_amount: 8000.00,
        due_date: "2024-12-15T23:59:59Z",
        days_remaining: 0,
        status: "due_today"
      }
    ],
    monthlySpending: {
      current_month: 41200.00,
      previous_month: 67500.00,
      change_percentage: -38.96
    },
    categoryWiseSpending: [
      {
        category: "Shopping",
        amount: 15000.00,
        percentage: 36.4,
        transactions: 1
      },
      {
        category: "Food & Dining",
        amount: 8700.00,
        percentage: 21.1,
        transactions: 2
      },
      {
        category: "Gas",
        amount: 8500.00,
        percentage: 20.6,
        transactions: 1
      },
      {
        category: "Groceries",
        amount: 12000.00,
        percentage: 29.1,
        transactions: 1
      }
    ],
    recentActivity: [
      {
        type: "transaction",
        description: "New transaction: Swiggy Order - Pizza Hut",
        amount: 2500.00,
        card: "HDFC Bank ****4567",
        timestamp: "2024-12-15T19:30:00Z"
      },
      {
        type: "transaction",
        description: "New transaction: Amazon Purchase - Electronics",
        amount: 15000.00,
        card: "HDFC Bank ****4567",
        timestamp: "2024-12-14T14:20:00Z"
      },
      {
        type: "payment",
        description: "Payment received for HDFC Bank card",
        amount: 12000.00,
        card: "HDFC Bank ****4567",
        timestamp: "2024-12-13T10:00:00Z"
      }
    ]
  }
};