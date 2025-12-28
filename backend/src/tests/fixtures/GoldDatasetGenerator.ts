import { SimplifiedEmail } from '../../types/transaction.types';

export interface GroundTruth {
    expectedType: 'credit_card_spend' | 'upi_spend' | 'bank_debit' | 'non_financial';
    expectedAmount?: number;
    expectedMerchant?: string;
    expectedDate?: Date;
    description: string;
}

export interface GeneratedTestCase {
    email: SimplifiedEmail;
    groundTruth: GroundTruth;
}

export class GoldDatasetGenerator {

    static generate(count: number = 50): GeneratedTestCase[] {
        const cases: GeneratedTestCase[] = [];
        for (let i = 0; i < count; i++) {
            const rand = Math.random();
            if (rand < 0.3) cases.push(this.generateHDFCSpend());
            else if (rand < 0.6) cases.push(this.generateUPISpend());
            else if (rand < 0.8) cases.push(this.generateSBISpend());
            else cases.push(this.generateNonFinancial());
        }
        return cases;
    }

    private static generateHDFCSpend(): GeneratedTestCase {
        const amount = Number((Math.random() * 5000 + 10).toFixed(2));
        const merchants = ['AMAZON PAY INDIA', 'FLIPKART', 'SWIGGY', 'ZOMATO', 'UBER INDIA', 'NETFLIX', 'APPLE SERVICES'];
        const merchant = merchants[Math.floor(Math.random() * merchants.length)];
        const last4 = '1234';
        const date = new Date();

        const body = `
            Dear Customer,
            
            Rs.${amount} was spent on your HDFC Bank Credit Card ending ${last4} on ${date.toDateString()} at ${merchant}.
            Authorization Code: 123456.
            
            Available Limit: Rs. 50,000.00
        `;

        return {
            email: this.makeEmail('HDFC Bank', 'alerts@hdfcbank.net', `Alert: Transaction of Rs.${amount} on Credit Card`, body),
            groundTruth: {
                expectedType: 'credit_card_spend',
                expectedAmount: amount,
                expectedMerchant: merchant,
                description: 'Simple HDFC Spend'
            }
        };
    }

    private static generateUPISpend(): GeneratedTestCase {
        const amount = Number((Math.random() * 2000 + 5).toFixed(2));
        const merchants = ['PAYTM-MERCHANT', 'GOOGLE PAY', 'BHARATPE', 'PHONPE PRIVATE LIMITED'];
        const merchant = merchants[Math.floor(Math.random() * merchants.length)];
        const vpa = `someone@oksbi`;

        const body = `
            Your UPI transaction of INR ${amount} is successful.
            Paid to: ${merchant}
            VPA: ${vpa}
            Txn ID: 1234567890
        `;

        return {
            email: this.makeEmail('UPI Alert', 'alerts@upi.com', `Sent Rs.${amount} to ${merchant}`, body),
            groundTruth: {
                expectedType: 'upi_spend',
                expectedAmount: amount,
                expectedMerchant: merchant, // May need normalization
                description: 'Standard UPI Spend'
            }
        };
    }

    private static generateSBISpend(): GeneratedTestCase {
        const amount = Number((Math.random() * 10000 + 100).toFixed(2));
        const merchant = 'AMAZON';
        const last4 = '9988';

        // SBI Format: Transaction of Rs. 1,000.00 made on SBI Credit Card ending 9988 at AMAZON.
        const body = `
            Dear Cardholder,
            Transaction of Rs. ${amount} made on SBI Credit Card ending ${last4} at ${merchant}.
            Info: Auth Code 123123.
        `;

        return {
            email: this.makeEmail('SBI Card', 'customercare@sbicard.com', `Transaction Alert`, body),
            groundTruth: {
                expectedType: 'credit_card_spend',
                expectedAmount: amount,
                expectedMerchant: merchant,
                description: 'SBI Credit Card Spend'
            }
        };
    }

    private static generateNonFinancial(): GeneratedTestCase {
        const templates = [
            { subject: 'Your Statement is Ready', body: 'Dear Customer, Your monthly statement for Jan 2024 is ready to view.' },
            { subject: 'OTP for Login', body: '123456 is your OTP for HDFC Netbanking access. Do not share.' },
            { subject: 'Happy Birthday!', body: 'Wishing you a very happy birthday from Team Zomato.' },
            { subject: 'Meeting Invite', body: 'Project discussion at 4 PM.' }
        ];
        const t = templates[Math.floor(Math.random() * templates.length)];

        return {
            email: this.makeEmail('Sender', 'sender@example.com', t.subject, t.body),
            groundTruth: {
                expectedType: 'non_financial',
                description: 'Non-financial email'
            }
        };
    }

    private static makeEmail(fromName: string, fromEmail: string, subject: string, body: string): SimplifiedEmail {
        return {
            messageId: `mock_${Math.random().toString(36).substring(7)}`,
            subject: subject,
            from: `"${fromName}" <${fromEmail}>`,
            body: body,
            snippet: body.substring(0, 100),
            internalDate: Date.now(),
            attachments: []
        };
    }
}
