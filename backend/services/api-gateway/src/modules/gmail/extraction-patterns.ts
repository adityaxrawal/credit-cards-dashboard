/**
 * Transaction extraction patterns for Indian banks
 */

export interface ExtractedTransaction {
  amount: number;
  currency: string;
  merchant: string;
  date: Date;
  cardLastFour: string | null;
  transactionType: "debit" | "credit";
  category: string | null;
  confidence: number;
  extractionMethod: "regex" | "template" | "llm";
  rawText: string;
}

export interface ExtractionPattern {
  bankCode: string;
  bankName: string;
  patterns: {
    amount: RegExp[];
    merchant: RegExp[];
    date: RegExp[];
    cardLastFour: RegExp[];
    transactionType: RegExp[];
  };
  examples: string[];
}

/**
 * HDFC Bank extraction patterns
 */
const HDFC_PATTERNS: ExtractionPattern = {
  bankCode: "hdfc",
  bankName: "HDFC Bank",
  patterns: {
    amount: [
      /(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)/gi,
      /(?:amount|spent|debited|charged)[\s:]+(?:rs\.?|inr|₹)?\s*([\d,]+\.?\d*)/gi,
      /transaction of (?:rs\.?|inr|₹)?\s*([\d,]+\.?\d*)/gi,
    ],
    merchant: [
      /(?:at|on|to)\s+([A-Z][A-Z0-9\s&\-\.]+?)(?:\s+on|\s+for|\s+amounting|\s+of|\.|\s*$)/gi,
      /(?:merchant|vendor)[\s:]+([A-Z][A-Z0-9\s&\-\.]+?)(?:\s+on|\.|$)/gi,
    ],
    date: [
      /on\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/gi,
      /date[\s:]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/gi,
      /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/gi,
    ],
    cardLastFour: [
      /card\s+(?:ending|no\.?|number)[\s:]+\*+(\d{4})/gi,
      /xx+(\d{4})/gi,
    ],
    transactionType: [
      /(debited|spent|charged|purchase)/gi,
      /(credited|refund|reversal)/gi,
    ],
  },
  examples: [
    "Rs 1,234.56 spent on SWIGGY on 15/01/2024 using Card xx1234",
    "HDFC Bank Card transaction of INR 5,000 at AMAZON on 20-Jan-2024",
  ],
};

/**
 * SBI Card extraction patterns
 */
const SBI_PATTERNS: ExtractionPattern = {
  bankCode: "sbi",
  bankName: "SBI Card",
  patterns: {
    amount: [
      /(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)/gi,
      /(?:amount|value)[\s:]+(?:rs\.?|inr|₹)?\s*([\d,]+\.?\d*)/gi,
    ],
    merchant: [
      /(?:at|on)\s+([A-Z][A-Z0-9\s&\-\.]+?)(?:\s+on|\s+dated|\.|\s*$)/gi,
    ],
    date: [
      /(?:on|dated)\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/gi,
      /(\d{1,2}-[A-Z][a-z]{2}-\d{2,4})/gi,
    ],
    cardLastFour: [
      /card\s+ending[\s:]+(\d{4})/gi,
      /card\s+xx+(\d{4})/gi,
    ],
    transactionType: [
      /(purchase|transaction|spent)/gi,
      /(credit|refund)/gi,
    ],
  },
  examples: [
    "SBI Card transaction of Rs. 2,500 at FLIPKART on 15/01/2024",
  ],
};

/**
 * ICICI Bank extraction patterns
 */
const ICICI_PATTERNS: ExtractionPattern = {
  bankCode: "icici",
  bankName: "ICICI Bank",
  patterns: {
    amount: [
      /(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)/gi,
      /transaction of (?:rs\.?|inr|₹)?\s*([\d,]+\.?\d*)/gi,
    ],
    merchant: [
      /(?:at|on)\s+([A-Z][A-Z0-9\s&\-\.]+?)(?:\s+on|\.|\s*$)/gi,
    ],
    date: [
      /on\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/gi,
      /(\d{2}-[A-Z][a-z]{2}-\d{4})/gi,
    ],
    cardLastFour: [
      /card\s+(?:ending|no)[\s:]+xx+(\d{4})/gi,
    ],
    transactionType: [
      /(debited|spent)/gi,
      /(credited|refund)/gi,
    ],
  },
  examples: [
    "ICICI Bank Credit Card transaction of Rs. 1,500 at ZOMATO on 01/02/2024",
  ],
};

/**
 * Axis Bank extraction patterns
 */
const AXIS_PATTERNS: ExtractionPattern = {
  bankCode: "axis",
  bankName: "Axis Bank",
  patterns: {
    amount: [
      /(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)/gi,
      /amt[\s:]+(?:rs\.?|inr|₹)?\s*([\d,]+\.?\d*)/gi,
    ],
    merchant: [
      /(?:at|on)\s+([A-Z][A-Z0-9\s&\-\.]+?)(?:\s+on|\.|\s*$)/gi,
    ],
    date: [
      /on\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/gi,
    ],
    cardLastFour: [
      /card\s+xx+(\d{4})/gi,
    ],
    transactionType: [
      /(debited|purchase)/gi,
      /(credited|refund)/gi,
    ],
  },
  examples: [
    "Axis Bank Card xx1234: Rs. 850 debited at UBER on 10/01/2024",
  ],
};

/**
 * IDFC First Bank extraction patterns
 */
const IDFC_PATTERNS: ExtractionPattern = {
  bankCode: "idfc",
  bankName: "IDFC First Bank",
  patterns: {
    amount: [
      /(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)/gi,
    ],
    merchant: [
      /(?:at|on)\s+([A-Z][A-Z0-9\s&\-\.]+?)(?:\s+on|\.|\s*$)/gi,
    ],
    date: [
      /on\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/gi,
    ],
    cardLastFour: [
      /card\s+ending[\s:]+(\d{4})/gi,
    ],
    transactionType: [
      /(spent|debited)/gi,
      /(credited|refund)/gi,
    ],
  },
  examples: [
    "IDFC First Bank: Rs 1,200 spent at MYNTRA on 05/02/2024",
  ],
};

/**
 * All bank patterns
 */
export const BANK_EXTRACTION_PATTERNS: Record<string, ExtractionPattern> = {
  hdfc: HDFC_PATTERNS,
  sbi: SBI_PATTERNS,
  icici: ICICI_PATTERNS,
  axis: AXIS_PATTERNS,
  idfc: IDFC_PATTERNS,
};

/**
 * Helper functions for extraction
 */

/**
 * Parse amount from string
 */
export function parseAmount(amountStr: string): number {
  // Remove currency symbols and commas
  const cleaned = amountStr.replace(/[₹,\s]/g, "").replace(/rs\.?|inr/gi, "");
  return parseFloat(cleaned);
}

/**
 * Parse date from various formats
 */
export function parseDate(dateStr: string): Date | null {
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = dateStr.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return new Date(`${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
  }

  // Try DD-MMM-YYYY
  const dmonthyMatch = dateStr.match(/(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2,4})/);
  if (dmonthyMatch) {
    const [, day, monthStr, year] = dmonthyMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return new Date(`${day} ${monthStr} ${fullYear}`);
  }

  return null;
}

/**
 * Clean merchant name
 */
export function cleanMerchantName(merchant: string): string {
  return merchant
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s&\-\.]/g, "")
    .toUpperCase();
}
