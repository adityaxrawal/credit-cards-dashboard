import { SimplifiedEmail } from '@shared/types/transaction.types';
import { GeneratedTestCase } from './GoldDatasetGenerator';

export interface DuplicateScenario {
    id: string;
    description: string;
    cases: GeneratedTestCase[];
}

export class DuplicateDatasetGenerator {
    static generate(count: number = 20): DuplicateScenario[] {
        const scenarios: DuplicateScenario[] = [];
        for (let i = 0; i < count; i++) {
            scenarios.push(this.generateScenario(i));
        }
        return scenarios;
    }

    private static generateScenario(index: number): DuplicateScenario {
        const rand = Math.random();
        if (rand < 0.4) return this.generateExactMatch(index);
        if (rand < 0.7) return this.generateSoftMatchDate(index);
        return this.generateSoftMatchMerchant(index);
    }

    private static generateExactMatch(index: number): DuplicateScenario {
        const amount = Number((Math.random() * 2000 + 100).toFixed(2));
        const merchant = 'UBER';
        const date = new Date(); // Same date

        const baseCase: GeneratedTestCase = {
            email: this.makeEmail('HDFC Bank', 'alerts@hdfcbank.net', 'Transaction Alert', `Rs.${amount} spent at ${merchant} on ${date.toDateString()}.`),
            groundTruth: { expectedType: 'credit_card_spend', expectedAmount: amount, expectedMerchant: merchant, description: 'Base Transaction' }
        };

        const duplicateCase: GeneratedTestCase = {
            email: this.makeEmail('HDFC Bank', 'alerts@hdfcbank.net', 'Transaction Alert', `Rs.${amount} spent at ${merchant} on ${date.toDateString()}.`), // Identical body
            groundTruth: { expectedType: 'credit_card_spend', expectedAmount: amount, expectedMerchant: merchant, description: 'Exact Duplicate' }
        };

        return {
            id: `exact_${index}`,
            description: 'Exact Match Duplicate',
            cases: [baseCase, duplicateCase]
        };
    }

    private static generateSoftMatchDate(index: number): DuplicateScenario {
        const amount = Number((Math.random() * 2000 + 100).toFixed(2));
        const merchant = 'SWIGGY';
        const date1 = new Date();
        const date2 = new Date(date1.getTime() + 24 * 60 * 60 * 1000); // 1 day later (e.g. settlement date vs auth date)

        const case1: GeneratedTestCase = {
            email: this.makeEmail('HDFC Bank', 'alerts@hdfcbank.net', 'Auth Alert', `Rs.${amount} authorized at ${merchant} on ${date1.toDateString()}.`),
            groundTruth: { expectedType: 'credit_card_spend', expectedAmount: amount, expectedMerchant: merchant, description: 'Auth' }
        };

        const case2: GeneratedTestCase = {
            email: this.makeEmail('HDFC Bank', 'alerts@hdfcbank.net', 'Transaction Alert', `You spent Rs.${amount} at ${merchant} on ${date2.toDateString()}.`),
            groundTruth: { expectedType: 'credit_card_spend', expectedAmount: amount, expectedMerchant: merchant, description: 'Settlement' }
        };

        return {
            id: `date_${index}`,
            description: 'Soft Match: Date Difference',
            cases: [case1, case2]
        };
    }

    private static generateSoftMatchMerchant(index: number): DuplicateScenario {
        const amount = Number((Math.random() * 2000 + 100).toFixed(2));
        const date = new Date();

        const case1: GeneratedTestCase = {
            email: this.makeEmail('HDFC Bank', 'alerts@hdfcbank.net', 'Alert', `Rs.${amount} spent at AMAZON PAY INDIA on ${date.toDateString()}.`),
            groundTruth: { expectedType: 'credit_card_spend', expectedAmount: amount, expectedMerchant: 'AMAZON PAY INDIA', description: 'Full Merchant' }
        };

        const case2: GeneratedTestCase = {
            email: this.makeEmail('HDFC Bank', 'alerts@hdfcbank.net', 'Alert', `Rs.${amount} spent at AMAZON.IN on ${date.toDateString()}.`),
            groundTruth: { expectedType: 'credit_card_spend', expectedAmount: amount, expectedMerchant: 'AMAZON.IN', description: 'Short Merchant' }
        };

        return {
            id: `merchant_${index}`,
            description: 'Soft Match: Merchant Variation',
            cases: [case1, case2]
        };
    }

    private static makeEmail(fromName: string, fromEmail: string, subject: string, body: string): SimplifiedEmail {
        return {
            messageId: `mock_dup_${Math.random().toString(36).substring(7)}`,
            subject: subject,
            from: `"${fromName}" <${fromEmail}>`,
            body: body,
            snippet: body.substring(0, 100),
            internalDate: Date.now(),
            attachments: []
        };
    }
}
