const pdf = require('pdf-parse');
import { IStatementParser } from './parsers/IStatementParser';
import { HDFCStatementParser } from './parsers/HDFCStatementParser';

export class StatementParserFactory {
    private static parsers: IStatementParser[] = [
        new HDFCStatementParser()
    ];

    /**
     * Get the appropriate parser for the given PDF buffer
     * Extracts text first to check signatures
     */
    /**
     * Get the appropriate parser for the given PDF buffer
     * Extracts text first to check signatures
     */
    static async getParser(buffer: Buffer, candidatePasswords: string[] = []): Promise<IStatementParser | null> {
        try {
            // @ts-ignore - pdf-parse types are not working correctly with esModuleInterop
            // pdf-parse v2 usage
            const { PDFParse } = pdf;

            // First try without password
            let parser = new PDFParse({ data: buffer });
            let data;

            try {
                data = await parser.getText();
            } catch (error: any) {
                if (error.name === 'PasswordException' && candidatePasswords.length > 0) {
                    console.info(`[StatementParserFactory] PDF is password protected. Attempting ${candidatePasswords.length} candidate passwords...`);

                    let unlocked = false;
                    for (const password of candidatePasswords) {
                        try {
                            const retryParser = new PDFParse({
                                data: buffer,
                                password: password
                            });
                            data = await retryParser.getText();
                            unlocked = true;
                            console.info(`[StatementParserFactory] Successfully unlocked PDF with password ending in ...${password.slice(-4)}`);
                            break;
                        } catch (retryError) {
                            // Continue to next password
                        }
                    }

                    if (!unlocked) {
                        console.warn('[StatementParserFactory] Failed to unlock PDF with any provided password');
                        return null;
                    }
                } else {
                    throw error;
                }
            }

            if (!data) return null;
            const text = data.text;

            for (const parser of this.parsers) {
                if (parser.supports(text)) {
                    return parser;
                }
            }
        } catch (error: any) {
            if (error.name === 'PasswordException') {
                // Warning only for password protected files, as we can't process them yet
                console.warn('[StatementParserFactory] Skipped password protected PDF (No valid password found)');
            } else {
                console.error('[StatementParserFactory] Failed to extract text for identification', error);
            }
        }

        return null; // No matching parser found
    }
}
