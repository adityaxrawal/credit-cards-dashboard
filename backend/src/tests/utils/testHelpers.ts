/**
 * Test utilities and helpers for the Credit Card Dashboard backend tests
 */

import { CleanEmail, TransactionType, TransactionDirection } from '../../types/transaction.types';

/**
 * Creates a mock email for testing extractors
 */
export const createMockEmail = (
    subject: string,
    body: string,
    options: Partial<CleanEmail> = {}
): CleanEmail => ({
    id: options.id || 'test-email-id',
    subject,
    from: options.from || 'bank@test.com',
    cleanedBody: body,
    internalDate: options.internalDate || Date.now(),
    hasAttachments: options.hasAttachments || false,
    ...options,
});

/**
 * Creates a mock user for testing
 */
export const createMockUser = (overrides = {}) => ({
    id: 'test-user-id',
    googleId: 'google-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/pic.jpg',
    monthly_budget: 30000,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
});

/**
 * Creates a mock transaction for testing
 */
export const createMockTransaction = (overrides = {}) => ({
    id: 'test-txn-id',
    user_id: 'test-user-id',
    instrument_type: 'credit_card',
    instrument_id: 'test-card-id',
    transaction_date: new Date(),
    amount: 1000,
    direction: TransactionDirection.DEBIT,
    merchant: 'Test Merchant',
    category: 'shopping',
    description: 'Test transaction',
    is_settled: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
});

/**
 * Creates a mock card/instrument for testing
 */
export const createMockCard = (overrides = {}) => ({
    id: 'test-card-id',
    user_id: 'test-user-id',
    type: 'credit_card',
    bank_id: 'test-bank-id',
    name: 'Test Credit Card',
    identifier: 'XXXX-XXXX-XXXX-1234',
    last4: '1234',
    balance: 0,
    currency: 'INR',
    status: 'active',
    is_primary: false,
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
});

/**
 * Creates a mock Express request
 */
export const createMockRequest = (overrides = {}) => ({
    user: createMockUser(),
    params: {},
    query: {},
    body: {},
    cookies: {},
    ...overrides,
});

/**
 * Creates a mock Express response with chainable methods
 */
export const createMockResponse = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
};

/**
 * Creates a mock next function
 */
export const createMockNext = () => jest.fn();

/**
 * Async delay helper
 */
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sample email bodies for testing extractors
 */
export const sampleEmails = {
    creditCardSpend: `
    Dear Customer,
    Your HDFC Credit Card ending 1234 has been used for a transaction of Rs. 2,500.00 at AMAZON.
    Transaction details:
    Card: XX1234
    Amount: Rs 2500.00
    Merchant: AMAZON
    Date: 28-Dec-2024
    If you did not authorize this transaction, please call our helpline.
  `,
    upiDebit: `
    Rs. 500.00 has been debited from your account XXXX1234 to VPA merchant@upi.
    UPI Ref: 123456789012
    Date: 28-Dec-2024
    Available Balance: Rs 15,000.00
  `,
    upiCredit: `
    Rs. 1,000.00 has been credited to your account XXXX5678 from VPA sender@upi.
    UPI Ref: 098765432109
    Date: 28-Dec-2024
  `,
    bankAccountCredit: `
    Dear Customer,
    An amount of Rs. 50,000.00 has been credited to your account ending 5678.
    Transaction type: NEFT
    Sender: ABC Company
    Ref No: NEFT12345
    Available Balance: Rs 75,000.00
  `,
    creditCardPayment: `
    Thank you for your credit card payment.
    Amount: Rs 15,000.00
    Card: XXXX1234
    Payment Date: 28-Dec-2024
    Reference: PAY123456
  `,
    refund: `
    A refund of Rs 999.00 has been credited to your credit card ending 1234.
    Original transaction: AMAZON
    Refund Reference: REF12345
  `,
};
