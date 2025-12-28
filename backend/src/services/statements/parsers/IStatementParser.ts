import { ExtractedStatement } from '../../../types/statement.types';

export interface IStatementParser {
    /**
     * Parse a PDF Document into a structured statement
     * @param pdfDoc - The unlocked PDFDocumentProxy from pdfjs-dist
     */
    parse(pdfDoc: any): Promise<ExtractedStatement>;

    /**
     * Check if this parser supports the given text
     */
    supports(text: string): boolean;
}
