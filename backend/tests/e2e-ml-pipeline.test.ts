import { describe, it, expect, beforeAll, afterAll } from 'jest';
import { OllamaService } from '../src/services/ollama.service';
import { CreditCardMailDetector } from '../src/services/CreditCardMailDetector';
import { EmailCleanerService } from '../src/services/emailCleaner.service';
import { validateMLOutput, normalizeCategory } from '../src/types/ml-schema';
import { gmail_v1 } from 'googleapis';

/**
 * End-to-End Tests with Fixtures
 * 
 * Tests the complete ML pipeline: Email Cleaning → ML Classification → Validation
 */

// Test fixtures representing real-world Indian bank emails
const FIXTURES = {
    // Transaction emails
    hdfc_transaction: {
        subject: 'HDFC Bank Credit Card Alert',
        body: `Dear Customer,

HDFC Bank Credit Card alert: Rs.1,234.56 spent at SWIGGY INDIA on card ending 5678 on 09-Dec-24 at 14:30.

Available credit limit: Rs.48,765.44

If not you, call 1800-xxx-xxxx immediately.

Regards,
HDFC Bank`,
        expected: {
            isTransaction: true,
            category: 'transaction_success',
            merchantContains: 'SWIGGY'
        }
    },

    sbi_transaction: {
        subject: 'SBI Card Transaction Alert',
        body: `Your SBI Card XX1234 has been used for a transaction of INR 2,450.00 at AMAZON PAY on 09-Dec-2024 20:15:32.

Available Credit Limit: INR 47,550.00

If this transaction was not done by you, please call our helpline immediately.`,
        expected: {
            isTransaction: true,
            category: 'transaction_success',
            merchantContains: 'AMAZON'
        }
    },

    icici_refund: {
        subject: 'ICICI Bank Refund Notification',
        body: `Dear Customer,

A refund of Rs.1,200.00 has been credited to your ICICI Bank Credit Card ending 5678 from FLIPKART on 08-Dec-2024.

This amount will be adjusted against your outstanding balance.

Thank you for banking with ICICI Bank.`,
        expected: {
            isTransaction: true,
            category: 'refund',
            merchantContains: 'FLIPKART'
        }
    },

    // Non-transaction emails
    axis_statement: {
        subject: 'Your Axis Bank Credit Card Statement',
        body: `Dear Customer,

Your Axis Bank Credit Card statement for November 2024 is ready.

Total Amount Due: Rs.15,000
Minimum Amount Due: Rs.1,500
Payment Due Date: 15-Dec-2024

Please log in to netbanking to view and download your statement.

Regards,
Axis Bank`,
        expected: {
            isTransaction: false,
            category: 'statement',
            merchantContains: null
        }
    },

    kotak_otp: {
        subject: 'OTP for Credit Card Transaction',
        body: `Your One Time Password (OTP) for Credit Card transaction is: 456789

This OTP is valid for 10 minutes. Do not share this OTP with anyone.

If you did not initiate this transaction, call 1800-xxx-xxxx immediately.`,
        expected: {
            isTransaction: false,
            category: 'otp',
            merchantContains: null
        }
    },

    yes_bank_marketing: {
        subject: 'Weekend Dining Offer - Get 20% Cashback!',
        body: `Dear Yes Bank Customer,

Exciting news! This weekend, enjoy 20% cashback on dining at select restaurants.

Use your Yes Bank Credit Card and get:
- 20% cashback up to Rs.500
- Valid at 1000+ restaurants
- Offer valid till 15-Dec-2024

T&C Apply. Visit yesbank.in for details.

Cheers,
Yes Bank Rewards Team`,
        expected: {
            isTransaction: false,
            category: 'non_transaction',
            merchantContains: null
        }
    },

    declined_transaction: {
        subject: 'Transaction Declined - IndusInd Bank',
        body: `Alert: Your transaction of Rs.5,000 at FLIPKART using IndusInd Bank Credit Card ending 3456 was declined.

Reason: Insufficient credit limit

Your available credit limit is: Rs.2,000

To increase your limit, please call customer care.`,
        expected: {
            isTransaction: false,
            category: 'non_transaction',
            merchantContains: null
        }
    },

    international_transaction: {
        subject: 'International Transaction Alert - HSBC',
        body: `HSBC Credit Card Alert: Your card ending 9012 was used for an international transaction.

Amount: USD 49.99 (INR 4,149.17)
Merchant: NETFLIX.COM
Date: 09-Dec-2024 03:30 AM IST

If not authorized by you, please block your card immediately.`,
        expected: {
            isTransaction: true,
            category: 'transaction_success',
            merchantContains: 'NETFLIX'
        }
    }
};

/**
 * Create mock Gmail message from fixture
 */
function createMockMessage(fixture: { subject: string; body: string }): gmail_v1.Schema$Message {
    const encodedBody = Buffer.from(fixture.body).toString('base64');

    return {
        id: `test-${Date.now()}`,
        threadId: `thread-${Date.now()}`,
        internalDate: String(Date.now()),
        snippet: fixture.body.substring(0, 100),
        payload: {
            headers: [
                { name: 'Subject', value: fixture.subject },
                { name: 'From', value: 'alerts@hdfcbank.net' }
            ],
            body: {
                data: encodedBody
            }
        }
    };
}

describe('End-to-End ML Pipeline Tests', () => {

    describe('Category Normalization', () => {
        it('should normalize standard categories', () => {
            expect(normalizeCategory('transaction_success')).toBe('transaction_success');
            expect(normalizeCategory('refund')).toBe('refund');
            expect(normalizeCategory('statement')).toBe('statement');
            expect(normalizeCategory('otp')).toBe('otp');
            expect(normalizeCategory('non_transaction')).toBe('non_transaction');
        });

        it('should normalize common variations', () => {
            expect(normalizeCategory('credit card')).toBe('transaction_success');
            expect(normalizeCategory('transaction')).toBe('transaction_success');
            expect(normalizeCategory('purchase')).toBe('transaction_success');
            expect(normalizeCategory('declined')).toBe('non_transaction');
            expect(normalizeCategory('promotional')).toBe('non_transaction');
        });

        it('should handle unknown categories', () => {
            expect(normalizeCategory('unknown_category')).toBe('non_transaction');
            expect(normalizeCategory('')).toBe('non_transaction');
        });
    });

    describe('Email Cleaner', () => {
        Object.entries(FIXTURES).forEach(([name, fixture]) => {
            it(`should clean ${name} email`, async () => {
                const message = createMockMessage(fixture);
                const cleaned = await EmailCleanerService.cleanEmailText(message);

                expect(cleaned).toBeDefined();
                expect(cleaned.length).toBeGreaterThan(10);
                expect(cleaned.length).toBeLessThan(20000); // Max limit
            });
        });
    });

    describe('ML Schema Validation', () => {
        it('should validate correct transaction output', () => {
            const valid = {
                isTransaction: true,
                category: 'transaction_success',
                merchant: 'SWIGGY',
                confidence: 0.95
            };

            const result = validateMLOutput(valid);
            expect(result).not.toBeNull();
            expect(result?.isTransaction).toBe(true);
        });

        it('should normalize and validate category variations', () => {
            const withVariation = {
                isTransaction: true,
                category: 'credit card',  // Will be normalized
                merchant: 'TEST',
                confidence: 0.9
            };

            const result = validateMLOutput(withVariation);
            expect(result).not.toBeNull();
            expect(result?.category).toBe('transaction_success');
        });

        it('should clamp out-of-range confidence', () => {
            const outOfRange = {
                isTransaction: false,
                category: 'non_transaction',
                merchant: null,
                confidence: 1.5  // > 1.0
            };

            const result = validateMLOutput(outOfRange);
            expect(result).not.toBeNull();
            expect(result?.confidence).toBe(1);
        });
    });
});

// Integration tests (require Ollama to be running)
describe('ML Classification Integration (requires Ollama)', () => {
    let ollamaAvailable = false;

    beforeAll(async () => {
        try {
            ollamaAvailable = await OllamaService.healthCheck();
        } catch (e) {
            console.warn('Ollama not available, skipping integration tests');
        }
    });

    Object.entries(FIXTURES).forEach(([name, fixture]) => {
        it(`should classify ${name} correctly`, async () => {
            if (!ollamaAvailable) {
                console.warn(`Skipping ${name} - Ollama not available`);
                return;
            }

            const message = createMockMessage(fixture);
            const result = await CreditCardMailDetector.detect(message);

            // Check basic structure
            expect(result).toHaveProperty('isTransaction');
            expect(result).toHaveProperty('category');
            expect(result).toHaveProperty('confidence');
            expect(result).toHaveProperty('cleanedText');

            // Check expected classification
            expect(result.isTransaction).toBe(fixture.expected.isTransaction);

            // Category might be normalized from ML output
            if (fixture.expected.category === 'transaction_success') {
                expect(['transaction_success', 'transaction', 'credit card', 'purchase']).toContain(
                    result.category.toLowerCase().replace(/_/g, ' ')
                );
            }

            // Check merchant for transactions
            if (fixture.expected.merchantContains) {
                expect(result.merchant?.toUpperCase()).toContain(fixture.expected.merchantContains);
            }
        }, 60000); // 60s timeout for ML processing
    });
});
