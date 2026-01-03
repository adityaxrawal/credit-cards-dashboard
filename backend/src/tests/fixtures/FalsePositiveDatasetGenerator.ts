import { SimplifiedEmail } from '@shared/types/transaction.types';
import { GeneratedTestCase } from './GoldDatasetGenerator';

export class FalsePositiveDatasetGenerator {

    static generate(count: number = 50): GeneratedTestCase[] {
        const cases: GeneratedTestCase[] = [];
        for (let i = 0; i < count; i++) {
            cases.push(this.generateRandomFalsePositive());
        }
        return cases;
    }

    private static generateRandomFalsePositive(): GeneratedTestCase {
        const generators = [
            this.generateMarketingOffer,
            this.generateLoanOffer,
            this.generateInvestmentUpdate,
            this.generatePaymentReminder,
            this.generateFailedTransaction,
            this.generateOTP,
            this.generateStatementAvailable
        ];

        const generator = generators[Math.floor(Math.random() * generators.length)];
        return generator.call(this);
    }

    private static generateMarketingOffer(): GeneratedTestCase {
        const amount = (Math.random() * 500).toFixed(0);
        return {
            email: this.makeEmail(
                'Amazon Offers',
                'offers@amazon.in',
                `Get Rs.${amount} cashback on your next order!`,
                `Great news! You can earn Rs.${amount} cashback on your next purchase of Rs. 1000 or more. Shop now!`
            ),
            groundTruth: {
                expectedType: 'non_financial',
                description: 'Marketing Offer with amount'
            }
        };
    }

    private static generateLoanOffer(): GeneratedTestCase {
        const amount = (Math.random() * 5 + 1).toFixed(1); // 1.5 to 6.5
        return {
            email: this.makeEmail(
                'HDFC Bank Loans',
                'loans@hdfcbank.net',
                `Pre-approved Personal Loan of Rs. ${amount} Lakhs`,
                `Dear Customer, You are eligible for a pre-approved Personal Loan of Rs. ${amount} Lakhs. No documentation required. Apply in 10 seconds!`
            ),
            groundTruth: {
                expectedType: 'non_financial',
                description: 'Loan Offer'
            }
        };
    }

    private static generateInvestmentUpdate(): GeneratedTestCase {
        const amount = (Math.random() * 50000 + 10000).toFixed(2);
        return {
            email: this.makeEmail(
                'Zerodha',
                'notifications@zerodha.com',
                `Daily Equity Portfolio Update`,
                `Your equity portfolio value is Rs. ${amount} as of today. Day's change: +1.2%.`
            ),
            groundTruth: {
                expectedType: 'non_financial',
                description: 'Investment Portfolio Value'
            }
        };
    }

    private static generatePaymentReminder(): GeneratedTestCase {
        const amount = (Math.random() * 10000 + 500).toFixed(2);
        return {
            email: this.makeEmail(
                'SBI Card',
                'statements@sbicard.com',
                `Payment Due: Rs. ${amount}`,
                `Dear Cardholder, your payment of Rs. ${amount} is due on 15th Jan. Please pay to avoid late fees.`
            ),
            groundTruth: {
                expectedType: 'non_financial',
                description: 'Credit Card Bill Due Reminder'
            }
        };
    }

    private static generateFailedTransaction(): GeneratedTestCase {
        const amount = (Math.random() * 2000).toFixed(2);
        return {
            email: this.makeEmail(
                'HDFC Bank Alert',
                'alerts@hdfcbank.net',
                `Declined: Transaction of Rs. ${amount}`,
                `Transaction of Rs. ${amount} on your Debit Card ending 1234 was declined due to insufficient funds.`
            ),
            groundTruth: {
                expectedType: 'non_financial',
                description: 'Failed Transaction'
            }
        };
    }

    private static generateOTP(): GeneratedTestCase {
        return {
            email: this.makeEmail(
                'ICICI Bank',
                'alerts@icicibank.com',
                'One Time Password',
                '123456 is your OTP for transaction of Rs. 500.00 at AMAZON. Do not share this with anyone.'
            ),
            groundTruth: {
                expectedType: 'non_financial',
                description: 'OTP Message'
            }
        };
    }

    private static generateStatementAvailable(): GeneratedTestCase {
        return {
            email: this.makeEmail(
                'Axis Bank',
                'statements@axisbank.com',
                'Your E-Statement is ready',
                'Dear Customer, your e-statement for period Dec 2025 is ready. Total Due: Rs. 12,345.00. Min Due: Rs. 500.00.'
            ),
            groundTruth: {
                expectedType: 'non_financial',
                description: 'Statement Notification'
            }
        };
    }

    private static makeEmail(fromName: string, fromEmail: string, subject: string, body: string): SimplifiedEmail {
        return {
            messageId: `mock_fp_${Math.random().toString(36).substring(7)}`,
            subject: subject,
            from: `"${fromName}" <${fromEmail}>`,
            body: body,
            snippet: body.substring(0, 100),
            internalDate: Date.now(),
            attachments: []
        };
    }
}
