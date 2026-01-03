import { StatementParserStrategy } from './strategies/StatementParserStrategy';
import { GenericParserStrategy } from './strategies/GenericParserStrategy';
import { HDFCParserStrategy } from './strategies/HDFCStrategy';

export interface ExtractedStatementTransaction {
    amount: number;
    date: string; // YYYY-MM-DD
    merchant: string;
    description: string;
    bank: string;
    currency: 'INR';
    category: string;
    confidence: number;
    evidence: {
        rawLine: string;
    };
}

export class StatementExtractor {
    private strategies: StatementParserStrategy[];

    constructor() {
        this.strategies = [
            new HDFCParserStrategy(),
            new GenericParserStrategy()
        ];
    }

    /**
     * Extract multiple transactions from a Statement Text (PDF content)
     */
    public extract(
        text: string,
        bankName: string,
        defaultDate: string
    ): ExtractedStatementTransaction[] {
        // 1. Find matching strategy
        const strategy = this.strategies.find(s => s.canHandle(bankName))
            || this.strategies.find(s => s.name === 'GENERIC'); // Fallback

        if (!strategy) {
            // Should theoretically never happen if Generic is present
            return [];
        }

        // 2. Parse
        const transactions = strategy.parse(text, defaultDate);

        // 3. Post-process (override bank name)
        return transactions.map(t => ({
            ...t,
            bank: bankName
        }));
    }
}

