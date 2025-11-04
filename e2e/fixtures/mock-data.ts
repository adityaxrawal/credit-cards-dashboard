/**
 * Mock data for E2E tests
 */

export const mockTransactions = [
  {
    id: "txn-1",
    user_id: "test-user-e2e-123",
    card_id: "card-1",
    amount: 1250.5,
    transaction_type: "debit",
    description: "Amazon Purchase",
    merchant: "Amazon",
    category: "Shopping",
    transaction_date: new Date("2025-11-01"),
    email_message_id: "msg-1",
  },
  {
    id: "txn-2",
    user_id: "test-user-e2e-123",
    card_id: "card-1",
    amount: 450.0,
    transaction_type: "debit",
    description: "Grocery Store",
    merchant: "BigBasket",
    category: "Groceries",
    transaction_date: new Date("2025-11-02"),
    email_message_id: "msg-2",
  },
  {
    id: "txn-3",
    user_id: "test-user-e2e-123",
    card_id: "card-2",
    amount: 2100.0,
    transaction_type: "debit",
    description: "Restaurant Bill",
    merchant: "Restaurant",
    category: "Dining",
    transaction_date: new Date("2025-11-03"),
    email_message_id: "msg-3",
  },
];

export const mockCards = [
  {
    id: "card-1",
    user_id: "test-user-e2e-123",
    card_name: "HDFC Regalia",
    bank_name: "HDFC Bank",
    card_type: "credit",
    last_four_digits: "1234",
    credit_limit: 100000,
    billing_date: 5,
    due_date: 20,
    is_active: true,
  },
  {
    id: "card-2",
    user_id: "test-user-e2e-123",
    card_name: "ICICI Amazon Pay",
    bank_name: "ICICI Bank",
    card_type: "credit",
    last_four_digits: "5678",
    credit_limit: 50000,
    billing_date: 10,
    due_date: 25,
    is_active: true,
  },
];

export const mockBudget = {
  user_id: "test-user-e2e-123",
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  budget_limit: 30000,
  total_spent: 3800.5,
  updated_at: new Date(),
  alert_sent: false,
};

export const mockAlerts = [
  {
    id: "alert-1",
    user_id: "test-user-e2e-123",
    alert_type: "budget_warning",
    priority: "medium",
    title: "Budget Warning",
    message: "You've used 85% of your monthly budget",
    is_read: false,
    created_at: new Date(),
  },
];

export const mockReminders = [
  {
    card_id: "card-1",
    card_name: "HDFC Regalia",
    bank_name: "HDFC Bank",
    due_date: 20,
    days_remaining: 5,
    message: "HDFC Regalia bill due on 20th (in 5 days)",
  },
];

export const mockGmailSyncResponse = {
  success: true,
  summary: {
    emailsScanned: 25,
    transactionEmailsFound: 3,
    newTransactions: 3,
    duplicatesSkipped: 0,
    processingTime: "2.45s",
  },
  lastSync: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
  nextSyncRecommended: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
};
