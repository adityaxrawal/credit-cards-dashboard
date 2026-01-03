
import { ExtractedStatementTransaction } from '../statement.extractor';

export interface StatementParserStrategy {
    /**
     * Unique identifier for the strategy (e.g., 'HDFC', 'ICICI', 'GENERIC')
     */
    name: string;

    /**
     * Check if this strategy handles the given bank
     */
    canHandle(bankName: string): boolean;

    /**
     * Parse the text content of the statement
     */
    parse(text: string, defaultDate: string): ExtractedStatementTransaction[];
}
