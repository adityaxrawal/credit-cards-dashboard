import { ExtractedStatement } from '../../../types/statement.types';

export interface IStatementParser {
    /**
     * Parse a PDF buffer into a structured statement
     */
    parse(buffer: Buffer): Promise<ExtractedStatement>;

    /**
     * Check if this parser supports the given text/metadata
     * (Optional helper for factory)
     */
    supports(text: string): boolean;
}
