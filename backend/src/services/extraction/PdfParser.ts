import { env } from '../../config/env';

// Define the worker source (required for Node.js usage)
// This might need adjustment depending on the exact version/environment
// but typically for backend node environments, we might not need worker if we use legacy build?
// Actually simpler in modern pdfjs-dist:
// We might need to silence a warning about worker
// "Warning: Setting up fake worker." is fine for backend usually.

export interface ExtractedPdfData {
  text: string;
  pageCount: number;
  usedPassword?: string;
}

export class PdfParser {

  private static readonly KNOWN_PASSWORDS = ['ADIT2305', 'ADIT2000'];

  /**
   * Parse PDF with automatic password fallback
   */
  /**
   * Parse PDF with provided passwords (or default fallback)
   */
  static async parseWithPasswords(buffer: Buffer, passwords: string[] = []): Promise<ExtractedPdfData | null> {
    const candidates = [...passwords, ...this.KNOWN_PASSWORDS]; // Try custom first, then known

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
          } catch (pwdErr) {
            if (!this.isPasswordError(pwdErr)) {
              console.warn(`[PdfParser] Non-password error with pwd ${pwd}:`, pwdErr);
            }
          }
        }
        console.warn('[PdfParser] Failed to decrypt PDF with provided passwords.');
        return null;
      } else {
        console.warn('[PdfParser] Error parsing PDF (not password related):', err);
        return null;
      }
    }
  }

  /**
   * Parse PDF with automatic password fallback (Legacy)
   */
  static async parseWithFallback(buffer: Buffer): Promise<ExtractedPdfData | null> {
    return this.parseWithPasswords(buffer, []);
  }

  private static async parsePdf(buffer: Buffer, password?: string): Promise<ExtractedPdfData> {
    // Dynamic import for CommonJS compatibility
    // @ts-ignore
    const pdfjsLib = await import('pdfjs-dist');

    // Convert Buffer to Uint8Array/ArrayBuffer
    const data = new Uint8Array(buffer);

    try {
      const loadingTask = pdfjsLib.getDocument({
        data,
        password: password,
        // Disable font loading to speed up/avoid canvas issues in Node?
        disableFontFace: true,
        verbosity: 0
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

    } catch (error) {
      throw error;
    }
  }

  private static isPasswordError(err: any): boolean {
    const msg = (err.message || err.name || '').toLowerCase();
    return msg.includes('password') || msg.includes('encrypted');
  }

  /**
  * Clean extracted text (remove excessive whitespace)
  */
  static cleanText(text: string): string {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }
}
