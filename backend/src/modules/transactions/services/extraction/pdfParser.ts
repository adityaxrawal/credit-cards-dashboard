import logger from '@shared/utils/infrastructure/logger';

/**
 * PDF Parser for Node.js using pdfjs-dist legacy build.
 * 
 * CRITICAL DESIGN DECISIONS:
 * 1. Use legacy build to avoid DOMMatrix/canvas browser-only APIs
 * 2. Singleton initialization to prevent race conditions from concurrent imports
 * 3. One-retry-then-fail strategy to prevent log pollution
 * 4. Proper error classification for password/parsing/corruption issues
 */

export interface ExtractedPdfData {
  text: string;
  pageCount: number;
  usedPassword?: string;
}

export type PdfErrorType = 'PASSWORD_REQUIRED' | 'PARSING_ERROR' | 'CORRUPTED' | 'UNKNOWN';

export interface PdfParseResult {
  success: boolean;
  data?: ExtractedPdfData;
  errorType?: PdfErrorType;
  errorMessage?: string;
}

// --- SINGLETON PDF.JS INITIALIZATION ---
// Load pdfjs-dist ONCE at module load to prevent race conditions
// --- SINGLETON PDF.JS INITIALIZATION ---
let pdfjsLib: any = null;
let initPromise: Promise<any> | null = null;

async function getPdfjsLib(): Promise<any> {
  if (pdfjsLib) return pdfjsLib;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        // Use standard import for pdfjs-dist
        // In Node 18+ we can use standard import, but for compatibility we use legacy build if needed
        // tailored for the installed version ^5.4.449
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const lib = pdfjs.default || pdfjs;

        // CRITICAL FIX: Set workerSrc to disable fake worker warning or ensure consistency
        // pointing to the installed worker file within node_modules
        // This resolves "No GlobalWorkerOptions.workerSrc specified"
        try {
          // We point to the local worker file to avoid "fake worker" issues if possible
          // However, simplest fix for Node is often setting it to false/null to strictly run on main thread without looking for worker
          // OR setting it to the actual path.
          // Let's try setting it to the path first, if that fails, we fallback.
          lib.GlobalWorkerOptions.workerSrc = './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs';
        } catch (e) {
          // If strictly failing, we set it to empty string which forces fake worker but might error if unconfigured
          lib.GlobalWorkerOptions.workerSrc = '';
        }

        pdfjsLib = lib;
        logger.debug('[PdfParser] pdfjs-dist initialized with workerSrc config');
        return pdfjsLib;
      } catch (err) {
        logger.error('[PdfParser] Failed to initialize pdfjs-dist:', err);
        throw err;
      }
    })();
  }
  return initPromise;
}

// Pre-initialize
getPdfjsLib().catch(err => logger.error('[PdfParser] Init failed', err));

export class PdfParser {
  private static readonly KNOWN_PASSWORDS = ['ADIT2305', 'ADIT2000'];

  // Track failed PDFs to prevent repeated retry attempts
  private static failedPdfs = new Map<string, { count: number; lastError: string }>();
  private static readonly MAX_RETRIES = 1;

  /**
   * Parse PDF with proper error handling and retry logic.
   * Returns structured result with error classification.
   */
  static async parse(buffer: Buffer, pdfId?: string): Promise<PdfParseResult> {
    const id = pdfId || this.getBufferHash(buffer);

    // Check if already failed too many times
    const failRecord = this.failedPdfs.get(id);
    if (failRecord && failRecord.count >= this.MAX_RETRIES) {
      logger.debug(`[PdfParser] Skipping previously failed PDF: ${id}`);
      return {
        success: false,
        errorType: 'PARSING_ERROR',
        errorMessage: `Previously failed: ${failRecord.lastError}`
      };
    }

    try {
      const result = await this.parseWithPasswords(buffer);

      if (result) {
        // Clear any previous failure record on success
        this.failedPdfs.delete(id);
        return { success: true, data: result };
      } else {
        this.recordFailure(id, 'All password attempts failed');
        return {
          success: false,
          errorType: 'PASSWORD_REQUIRED',
          errorMessage: 'Failed to decrypt PDF with known passwords'
        };
      }
    } catch (err: any) {
      const errorType = this.classifyError(err);
      const errorMessage = err.message || 'Unknown error';

      this.recordFailure(id, errorMessage);

      return {
        success: false,
        errorType,
        errorMessage
      };
    }
  }

  /**
   * Parse PDF with provided passwords (or default fallback)
   */
  static async parseWithPasswords(buffer: Buffer, passwords: string[] = []): Promise<ExtractedPdfData | null> {
    const candidates = [...passwords, ...this.KNOWN_PASSWORDS];

    // 1. Try without password
    try {
      return await this.parsePdf(buffer, '');
    } catch (err: any) {
      if (this.isPasswordError(err)) {
        // 2. Try candidate passwords
        for (const pwd of candidates) {
          try {
            const result = await this.parsePdf(buffer, pwd);
            result.usedPassword = pwd;
            return result;
          } catch (pwdErr: any) {
            if (!this.isPasswordError(pwdErr)) {
              logger.debug(`[PdfParser] Non-password error with pwd attempt`);
            }
            // Continue to next password
          }
        }
        return null;
      } else {
        throw err; // Re-throw non-password errors
      }
    }
  }

  /**
   * Parse PDF with automatic password fallback (Legacy API)
   */
  static async parseWithFallback(buffer: Buffer): Promise<ExtractedPdfData | null> {
    const result = await this.parse(buffer);
    return result.success ? result.data! : null;
  }

  private static async parsePdf(buffer: Buffer, password?: string): Promise<ExtractedPdfData> {
    const pdfjs = await getPdfjsLib();
    const data = new Uint8Array(buffer);

    const loadingTask = pdfjs.getDocument({
      data,
      password: password || undefined,
      disableFontFace: true, // Disable fonts to avoid canvas issues
      verbosity: 0, // Minimize console output
      useSystemFonts: false,
      isEvalSupported: false,
      useWorkerFetch: false
    });

    const doc = await loadingTask.promise;

    let fullText = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return {
      text: this.cleanText(fullText),
      pageCount: doc.numPages
    };
  }

  private static classifyError(err: any): PdfErrorType {
    const msg = (err.message || err.name || '').toLowerCase();

    if (msg.includes('password') || msg.includes('encrypted')) {
      return 'PASSWORD_REQUIRED';
    }
    if (msg.includes('invalid') || msg.includes('corrupt') || msg.includes('not a pdf')) {
      return 'CORRUPTED';
    }
    if (msg.includes('parse') || msg.includes('syntax') || msg.includes('stream')) {
      return 'PARSING_ERROR';
    }
    return 'UNKNOWN';
  }

  private static isPasswordError(err: any): boolean {
    return this.classifyError(err) === 'PASSWORD_REQUIRED';
  }

  private static recordFailure(id: string, error: string): void {
    const existing = this.failedPdfs.get(id);
    this.failedPdfs.set(id, {
      count: (existing?.count || 0) + 1,
      lastError: error
    });

    // Cleanup old entries to prevent memory leak (keep last 1000)
    if (this.failedPdfs.size > 1000) {
      const firstKey = this.failedPdfs.keys().next().value;
      if (firstKey) this.failedPdfs.delete(firstKey);
    }
  }

  private static getBufferHash(buffer: Buffer): string {
    // Simple hash for deduplication - use first/last bytes + length
    const len = buffer.length;
    return `${len}-${buffer[0]}-${buffer[Math.floor(len / 2)]}-${buffer[len - 1]}`;
  }

  /**
   * Clean extracted text (remove excessive whitespace)
   */
  static cleanText(text: string): string {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }


  /**
   * Clear failure tracking (for testing or periodic cleanup)
   */
  static clearFailureCache(): void {
    this.failedPdfs.clear();
  }

  // --- EXTRACTION LOGIC ---

  /**
   * Extract potential transactions from PDF text using generic regex patterns.
   * This is a heuristic approach for "Partially Implemented" status.
   */
  static extractTransactionsFromText(text: string): any[] {
    const transactions: any[] = [];
    const lines = text.split('\n');

    // Generic Date Pattern: DD/MM/YYYY or DD-MM-YYYY
    const dateRegex = /\d{2}[\/\-]\d{2}[\/\-]\d{4}/;

    // Generic Amount Pattern: Number with decimals or commas
    // e.g. 1,234.56 or 1234.56
    const amountRegex = /(?:Rs\.?|INR)?\s*[\d,]+\.\d{2}/i;

    for (const line of lines) {
      // Simple heuristic: Line must have a date and an amount
      const dateMatch = line.match(dateRegex);
      const amountMatch = line.match(amountRegex);

      if (dateMatch && amountMatch) {
        // It's a candidate
        const date = dateMatch[0];
        const amountStr = amountMatch[0].replace(/[^0-9.]/g, ''); // strip currency symbols
        const description = line.replace(dateMatch[0], '').replace(amountMatch[0], '').trim();

        transactions.push({
          date,
          amount: parseFloat(amountStr),
          description: this.cleanText(description),
          originalLine: line
        });
      }
    }

    return transactions;
  }
}

