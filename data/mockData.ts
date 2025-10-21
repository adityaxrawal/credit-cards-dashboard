// Mock data for development and testing

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

export const mockCards: MockCard[] = [
  {
    id: 'card_001',
    bank_name: 'Chase',
    card_last_4: '4532',
    card_holder_name: 'John Doe',
    card_type: 'Visa',
    credit_limit: 10000,
    available_credit: 6750,
    reward_points: 1250,
  },
  {
    id: 'card_002',
    bank_name: 'American Express',
    card_last_4: '8923',
    card_holder_name: 'John Doe',
    card_type: 'Amex',
    credit_limit: 15000,
    available_credit: 12200,
    reward_points: 2100,
  },
  {
    id: 'card_003',
    bank_name: 'Citi',
    card_last_4: '3421',
    card_holder_name: 'John Doe',
    card_type: 'Mastercard',
    credit_limit: 8000,
    available_credit: 5350,
    reward_points: 890,
  },
];

export const mockTransactions: MockTransaction[] = [
  {
    id: 'txn_001',
    merchant: 'Amazon',
    amount: 249.99,
    date: '2024-12-15',
    category: 'Shopping',
    type: 'debit',
    status: 'completed',
  },
  {
    id: 'txn_002',
    merchant: 'Starbucks',
    amount: 12.50,
    date: '2024-12-14',
    category: 'Food & Dining',
    type: 'debit',
    status: 'completed',
  },
  {
    id: 'txn_003',
    merchant: 'Uber',
    amount: 28.75,
    date: '2024-12-14',
    category: 'Transportation',
    type: 'debit',
    status: 'completed',
  },
  {
    id: 'txn_004',
    merchant: 'Netflix',
    amount: 15.99,
    date: '2024-12-13',
    category: 'Entertainment',
    type: 'debit',
    status: 'completed',
  },
  {
    id: 'txn_005',
    merchant: 'Cashback Reward',
    amount: 25.00,
    date: '2024-12-13',
    category: 'Rewards',
    type: 'credit',
    status: 'completed',
  },
  {
    id: 'txn_006',
    merchant: 'Gas Station',
    amount: 45.20,
    date: '2024-12-12',
    category: 'Fuel',
    type: 'debit',
    status: 'completed',
  },
  {
    id: 'txn_007',
    merchant: 'Grocery Store',
    amount: 89.45,
    date: '2024-12-12',
    category: 'Groceries',
    type: 'debit',
    status: 'completed',
  },
  {
    id: 'txn_008',
    merchant: 'Apple Store',
    amount: 199.99,
    date: '2024-12-11',
    category: 'Electronics',
    type: 'debit',
    status: 'pending',
  },
];