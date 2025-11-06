/**
 * Bank Transaction Pattern
 * Defines extraction patterns for a specific bank
 */
export interface BankPattern {
  bankName: string;
  patterns: TransactionPattern[];
}

/**
 * Transaction Pattern
 * Regex pattern with field mapping
 */
export interface TransactionPattern {
  name: string;
  regex: RegExp;
  priority: number;
  mapping: {
    amount?: number | string;
    transactionType?: "debit" | "credit" | "refund";
    merchant?: number | string;
    date?: number | string;
    balance?: number | string;
    cardLast4?: number | string;
    transactionId?: number | string;
    currency?: string;
  };
  confidenceWeight: number;
}

/**
 * Extracted Transaction Data
 */
export interface ExtractedTransaction {
  amount: number;
  transactionType: "debit" | "credit" | "refund";
  merchant?: string;
  date?: Date;
  balance?: number;
  cardLast4?: string;
  transactionId?: string;
  currency: string;
  rawText: string;
  patternName: string;
}

/**
 * HDFC Bank Patterns
 */
export const HDFC_PATTERNS: BankPattern = {
  bankName: "HDFC Bank",
  patterns: [
    {
      name: "Debit Transaction",
      regex:
        /(?:INR|Rs\.?)\s*([\d,]+\.?\d*)\s+(?:debited|spent|deducted).*?(?:on|at)\s+([A-Z][A-Za-z0-9\s\-\.]+).*?(?:Card ending|xx)(\d{4})/is,
      priority: 100,
      mapping: {
        amount: 1,
        transactionType: "debit",
        merchant: 2,
        cardLast4: 3,
        currency: "INR",
      },
      confidenceWeight: 0.9,
    },
    {
      name: "Credit/Refund",
      regex:
        /(?:INR|Rs\.?)\s*([\d,]+\.?\d*)\s+credited.*?(?:from|by)\s+([A-Z][A-Za-z0-9\s\-\.]+).*?(?:Card ending|xx)(\d{4})/is,
      priority: 95,
      mapping: {
        amount: 1,
        transactionType: "credit",
        merchant: 2,
        cardLast4: 3,
        currency: "INR",
      },
      confidenceWeight: 0.9,
    },
    {
      name: "Simple Debit",
      regex:
        /(?:INR|Rs\.?)\s*([\d,]+\.?\d*)\s+(?:debited|spent).*?(?:xx|ending)(\d{4})/is,
      priority: 80,
      mapping: {
        amount: 1,
        transactionType: "debit",
        cardLast4: 2,
        currency: "INR",
      },
      confidenceWeight: 0.7,
    },
    {
      name: "Balance Update",
      regex:
        /(?:available )?balance.*?(?:INR|Rs\.?)\s*([\d,]+\.?\d*)/is,
      priority: 50,
      mapping: {
        balance: 1,
        currency: "INR",
      },
      confidenceWeight: 0.5,
    },
  ],
};

/**
 * ICICI Bank Patterns
 */
export const ICICI_PATTERNS: BankPattern = {
  bankName: "ICICI Bank",
  patterns: [
    {
      name: "Purchase Transaction",
      regex:
        /(?:INR|Rs\.?)\s*([\d,]+\.?\d*)\s+(?:has been|spent).*?(?:at|on)\s+([A-Z][A-Za-z0-9\s\-\.]+).*?(?:Card|ICICI).*?(\d{4})/is,
      priority: 100,
      mapping: {
        amount: 1,
        transactionType: "debit",
        merchant: 2,
        cardLast4: 3,
        currency: "INR",
      },
      confidenceWeight: 0.9,
    },
    {
      name: "Payment Received",
      regex:
        /(?:INR|Rs\.?)\s*([\d,]+\.?\d*)\s+credited.*?(?:Card|Account).*?(\d{4})/is,
      priority: 95,
      mapping: {
        amount: 1,
        transactionType: "credit",
        cardLast4: 2,
        currency: "INR",
      },
      confidenceWeight: 0.85,
    },
    {
      name: "Transaction Alert",
      regex:
        /(?:INR|Rs\.?)\s*([\d,]+\.?\d*)\s+(?:debited|withdrawn).*?(\d{4})/is,
      priority: 85,
      mapping: {
        amount: 1,
        transactionType: "debit",
        cardLast4: 2,
        currency: "INR",
      },
      confidenceWeight: 0.75,
    },
  ],
};

/**
 * SBI (State Bank of India) Patterns
 */
export const SBI_PATTERNS: BankPattern = {
  bankName: "State Bank of India",
  patterns: [
    {
      name: "Card Transaction",
      regex:
        /(?:INR|Rs\.?)\s*([\d,]+\.?\d*)\s+(?:debited|spent).*?(?:at|POS)\s+([A-Z][A-Za-z0-9\s\-\.]+).*?(\d{4})/is,
      priority: 100,
      mapping: {
        amount: 1,
        transactionType: "debit",
        merchant: 2,
        cardLast4: 3,
        currency: "INR",
      },
      confidenceWeight: 0.9,
    },
    {
      name: "Credit Alert",
      regex:
        /(?:INR|Rs\.?)\s*([\d,]+\.?\d*)\s+credited.*?(?:Card|Account).*?(\d{4})/is,
      priority: 90,
      mapping: {
        amount: 1,
        transactionType: "credit",
        cardLast4: 2,
        currency: "INR",
      },
      confidenceWeight: 0.85,
    },
  ],
};

/**
 * Axis Bank Patterns
 */
export const AXIS_PATTERNS: BankPattern = {
  bankName: "Axis Bank",
  patterns: [
    {
      name: "Purchase Alert",
      regex:
        /(?:INR|Rs\.?)\s*([\d,]+\.?\d*)\s+(?:spent|used).*?(?:at|on)\s+([A-Z][A-Za-z0-9\s\-\.]+).*?(?:Card|xx)(\d{4})/is,
      priority: 100,
      mapping: {
        amount: 1,
        transactionType: "debit",
        merchant: 2,
        cardLast4: 3,
        currency: "INR",
      },
      confidenceWeight: 0.9,
    },
    {
      name: "Refund Alert",
      regex:
        /(?:INR|Rs\.?)\s*([\d,]+\.?\d*)\s+(?:refunded|credited).*?(?:from|by)\s+([A-Z][A-Za-z0-9\s\-\.]+).*?(\d{4})/is,
      priority: 95,
      mapping: {
        amount: 1,
        transactionType: "refund",
        merchant: 2,
        cardLast4: 3,
        currency: "INR",
      },
      confidenceWeight: 0.9,
    },
  ],
};

/**
 * Kotak Mahindra Bank Patterns
 */
export const KOTAK_PATTERNS: BankPattern = {
  bankName: "Kotak Mahindra Bank",
  patterns: [
    {
      name: "Transaction Notification",
      regex:
        /(?:INR|Rs\.?)\s*([\d,]+\.?\d*)\s+(?:debited|spent).*?(?:at|on)\s+([A-Z][A-Za-z0-9\s\-\.]+).*?(\d{4})/is,
      priority: 100,
      mapping: {
        amount: 1,
        transactionType: "debit",
        merchant: 2,
        cardLast4: 3,
        currency: "INR",
      },
      confidenceWeight: 0.9,
    },
  ],
};

/**
 * American Express Patterns
 */
export const AMEX_PATTERNS: BankPattern = {
  bankName: "American Express",
  patterns: [
    {
      name: "Card Purchase",
      regex:
        /(?:USD|INR|Rs\.?)\s*([\d,]+\.?\d*)\s+(?:charged|spent).*?(?:at|on)\s+([A-Z][A-Za-z0-9\s\-\.]+).*?(?:Card ending|xx)(\d{4})/is,
      priority: 100,
      mapping: {
        amount: 1,
        transactionType: "debit",
        merchant: 2,
        cardLast4: 3,
        currency: "INR",
      },
      confidenceWeight: 0.9,
    },
  ],
};

/**
 * Generic Fallback Patterns
 * Used when bank-specific patterns don't match
 */
export const GENERIC_PATTERNS: BankPattern = {
  bankName: "Generic",
  patterns: [
    {
      name: "Generic Debit",
      regex:
        /(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d*)\s+(?:debited|spent|deducted|charged)/is,
      priority: 50,
      mapping: {
        amount: 1,
        transactionType: "debit",
        currency: "INR",
      },
      confidenceWeight: 0.5,
    },
    {
      name: "Generic Credit",
      regex:
        /(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d*)\s+(?:credited|received|refunded)/is,
      priority: 50,
      mapping: {
        amount: 1,
        transactionType: "credit",
        currency: "INR",
      },
      confidenceWeight: 0.5,
    },
    {
      name: "Amount with Card",
      regex: /(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d*).*?(?:Card|xx)(\d{4})/is,
      priority: 40,
      mapping: {
        amount: 1,
        cardLast4: 2,
        currency: "INR",
      },
      confidenceWeight: 0.4,
    },
  ],
};

/**
 * All bank patterns registry
 */
export const ALL_BANK_PATTERNS: BankPattern[] = [
  HDFC_PATTERNS,
  ICICI_PATTERNS,
  SBI_PATTERNS,
  AXIS_PATTERNS,
  KOTAK_PATTERNS,
  AMEX_PATTERNS,
];
