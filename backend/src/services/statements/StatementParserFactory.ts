// Top-level import removed to support dynamic import of ESM module
// import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { IStatementParser } from './parsers/IStatementParser';
import { HDFCStatementParser } from './parsers/HDFCStatementParser';
import { ExtractedStatement } from '../../types/statement.types';

export class StatementParserFactory {
    private static parsers: IStatementParser[] = [
        new HDFCStatementParser()
    ];

    /**
     * Process a PDF buffer: unlock, identify bank, and parse
     */
    static async process(buffer: Buffer, candidatePasswords: string[] = []): Promise<ExtractedStatement | null> {
        try {
            // Convert Buffer to Uint8Array which pdfjs expects
            const data = new Uint8Array(buffer);

            // Dynamic import for ESM module support in CJS environment
            // @ts-ignore
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

            // Helper to try loading PDF
            const loadPdf = async (password?: string) => {
                const loadingTask = pdfjsLib.getDocument({
                    data,
                    password: password || '',
                    disableFontFace: true,
                    useSystemFonts: true,
                    isEvalSupported: false, // For security
                });
                return loadingTask.promise;
            };

            let pdfDoc = null;
            let unlocked = false;

            // 1. Try No Password
            try {
                pdfDoc = await loadPdf();
                unlocked = true;
            } catch (error: any) {
                if (error.name === 'PasswordException' || (error.message && error.message.includes('Password'))) {
                    // Password required
                } else {
                    console.error('[StatementParserFactory] PDF Load Error (Not Password):', error);
                    return null;
                }
            }

            // 2. Try Candidates if locked
            if (!unlocked && candidatePasswords.length > 0) {
                console.info(`[StatementParserFactory] PDF Locked. Trying ${candidatePasswords.length} passwords...`);
                for (const pwd of candidatePasswords) {
                    try {
                        pdfDoc = await loadPdf(pwd);
                        unlocked = true;
                        console.info(`[StatementParserFactory] Unlocked PDF with password ending in ...${pwd.slice(-3)}`);
                        break;
                    } catch (e) {
                        // Wrong password, continue
                    }
                }
            }

            if (!unlocked || !pdfDoc) {
                if (!unlocked && candidatePasswords.length > 0) {
                    console.warn('[StatementParserFactory] Could not unlock PDF with provided passwords.');
                } else if (!unlocked) {
                    console.warn('[StatementParserFactory] Skipped password protected PDF (No passwords provided)');
                }
                return null;
            }

            // 3. Extract Text from First Page to Identify Bank
            // We only need the first page usually to identify format
            const page = await pdfDoc.getPage(1);
            const tokenizedText = await page.getTextContent();

            // pdfjs-dist v3/v4 structure: items string array
            const text = tokenizedText.items.map((item: any) => item.str).join(' ');

            // Cleanup if necessary (pdfjs doc usually doesn't have explicit cleanup for non-worker unless destroyed)
            // pdfDoc.destroy(); 
            // v5 might have strict memory management.

            // 4. Match Parser & Parse
            for (const parser of this.parsers) {
                if (parser.supports(text)) {
                    console.info(`[StatementParserFactory] Identified statement format: ${parser.constructor.name}`);
                    return await parser.parse(pdfDoc);
                }
            }

            // Console log the text snippet for debugging unmatched
            console.debug(`[StatementParserFactory] Unmatched PDF Text snippet: ${text.substring(0, 100)}...`);

        } catch (error: any) {
            console.error('[StatementParserFactory] Fatal error in getParser:', error);
        }

        return null;
    }
}
