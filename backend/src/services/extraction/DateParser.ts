import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

export class DateParser {
  /**
   * Parse date from string using multiple formats
   */
  static parse(dateString: string): Date | null {
    if (!dateString) return null;

    // Clean up the string
    const cleanDate = dateString.trim().replace(/['"]/g, '').replace(/(\d+)(st|nd|rd|th)/, '$1');

    const formats = [
      'DD/MM/YYYY',
      'DD-MM-YYYY',
      'YYYY-MM-DD',
      'DD MMM YYYY',
      'DD MMM, YYYY',
      'DD MMMM YYYY',
      'DD-MMM-YY',
      'DD-MMM-YYYY',
      'MMM DD, YYYY',
      'MM/DD/YYYY', // US format fallback
    ];

    for (const format of formats) {
      const d = dayjs(cleanDate, format, true); // Strict parsing
      if (d.isValid()) {
        return d.toDate();
      }
    }

    // Try non-strict parsing as fallback
    const d = dayjs(cleanDate);
    if (d.isValid()) {
      return d.toDate();
    }

    return null;
  }

  /**
   * Extract date from text using regex
   */
  static extract(text: string): Date | null {
    if (!text) return null;

    // Common patterns
    const patterns = [
      // DD/MM/YYYY or DD-MM-YYYY
      /\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})\b/,
      // DD MMM YYYY or DD MMM, YYYY (e.g. 14 Nov 2023, 14th Nov 2023)
      /\b(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9},?\s+\d{4})\b/,
      // YYYY-MM-DD
      /\b(\d{4}-\d{1,2}-\d{1,2})\b/,
      // DD-MMM-YY (e.g. 14-NOV-23)
      /\b(\d{1,2}-[A-Za-z]{3}-\d{2})\b/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const parsed = this.parse(match[1]);
        if (parsed) return parsed;
      }
    }

    return null;
  }
}
