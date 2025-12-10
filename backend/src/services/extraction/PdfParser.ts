const pdf = require('pdf-parse');

export class PdfParser {
  /**
   * Extract text from PDF buffer
   */
  static async extractText(buffer: Buffer): Promise<string> {
    try {
      const data = await pdf(buffer);
      if (!data.text || data.text.trim().length === 0) {
        console.warn('[PdfParser] PDF extracted text is empty. OCR (Tesseract) fallback would be required here but is not installed.');
        return '';
      }
      return data.text;
    } catch (error) {
      console.error('[PdfParser] Error parsing PDF:', error);
      return '';
    }
  }

  /**
   * Clean extracted text (remove excessive whitespace)
   */
  static cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }
}
