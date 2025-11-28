import * as gmailClient from '../lib/gmailClient';
import * as cardsQueries from '../db/queries/cards.queries';
import { GmailMessage } from '../lib/gmailClient';

interface ExtractionResult {
  status: 'success' | 'error' | 'unknown_format';
  transaction?: {
    amount: number;
    transactionDate: Date;
    merchant: string;
    bankName: string;
    lastFourDigits: string;
    category: string;
  };
  error?: string;
}

/**
 * Bank email patterns and parsers
 */
const bankTemplates = [
  {
    name: 'SBI',
    fromPattern: /sbi|state bank/i,
    subjectPattern: /transaction|spent|purchase/i,
    parser: (message: GmailMessage) => parseSBIEmail(message),
  },
  {
    name: 'HDFC',
    fromPattern: /hdfc/i,
    subjectPattern: /transaction|card.*used/i,
    parser: (message: GmailMessage) => parseHDFCEmail(message),
  },
  {
    name: 'ICICI',
    fromPattern: /icici/i,
    subjectPattern: /transaction|purchase/i,
    parser: (message: GmailMessage) => parseICICIEmail(message),
  },
  {
    name: 'Axis',
    fromPattern: /axis/i,
    subjectPattern: /transaction|spent/i,
    parser: (message: GmailMessage) => parseAxisEmail(message),
  },
  // Add more bank templates as needed
];

/**
 * Extract transaction from email
 */
export async function extractTransactionFromEmail(
  userId: string,
  message: GmailMessage
): Promise<ExtractionResult> {
  try {
    // Find matching template
    const template = bankTemplates.find(t =>
      t.fromPattern.test(message.from) && t.subjectPattern.test(message.subject)
    );
    
    if (!template) {
      return {
        status: 'unknown_format',
        error: 'No matching bank template found',
      };
    }
    
    // Parse email
    const parsed = template.parser(message);
    
    if (!parsed) {
      return {
        status: 'error',
        error: 'Failed to parse email content',
      };
    }
    
    // Find matching card
    const card = await cardsQueries.findCardByBankAndLastFour(
      userId,
      parsed.bankName,
      parsed.lastFourDigits
    );
    
    if (!card) {
      console.warn(`[ExtractionService] No card found for ${parsed.bankName} ending in ${parsed.lastFourDigits}`);
      // Still return success but log warning
    }
    
    return {
      status: 'success',
      transaction: {
        amount: parsed.amount,
        transactionDate: parsed.transactionDate,
        merchant: parsed.merchant,
        bankName: parsed.bankName,
        lastFourDigits: parsed.lastFourDigits,
        category: parsed.category || 'Others',
      },
    };
  } catch (error) {
    console.error('[ExtractionService] Error extracting transaction:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Parse SBI email
 */
function parseSBIEmail(message: GmailMessage) {
  const text = message.bodyText;
  
  // Example patterns - adjust based on actual email format
  const amountMatch = text.match(/(?:INR|Rs\.?)\s*([0-9,]+\.?[0-9]*)/i);
  const merchantMatch = text.match(/at\s+([A-Z0-9\s]+)/i);
  const cardMatch = text.match(/card\s+(?:ending\s+)?(\d{4})/i);
  const dateMatch = text.match(/on\s+(\d{2}[-\/]\d{2}[-\/]\d{4})/i);
  
  if (!amountMatch || !cardMatch) {
    return null;
  }
  
  return {
    amount: parseFloat(amountMatch[1].replace(/,/g, '')),
    merchant: merchantMatch ? merchantMatch[1].trim() : 'Unknown Merchant',
    lastFourDigits: cardMatch[1],
    bankName: 'SBI',
    transactionDate: dateMatch ? new Date(dateMatch[1]) : new Date(),
    category: 'Others',
  };
}

/**
 * Parse HDFC email
 */
function parseHDFCEmail(message: GmailMessage) {
  const text = message.bodyText;
  
  const amountMatch = text.match(/(?:INR|Rs\.?)\s*([0-9,]+\.?[0-9]*)/i);
  const merchantMatch = text.match(/at\s+([A-Z0-9\s]+)/i);
  const cardMatch = text.match(/card\s+(?:ending\s+)?(\d{4})/i);
  const dateMatch = text.match(/on\s+(\d{2}[-\/]\d{2}[-\/]\d{4})/i);
  
  if (!amountMatch || !cardMatch) {
    return null;
  }
  
  return {
    amount: parseFloat(amountMatch[1].replace(/,/g, '')),
    merchant: merchantMatch ? merchantMatch[1].trim() : 'Unknown Merchant',
    lastFourDigits: cardMatch[1],
    bankName: 'HDFC',
    transactionDate: dateMatch ? new Date(dateMatch[1]) : new Date(),
    category: 'Others',
  };
}

/**
 * Parse ICICI email
 */
function parseICICIEmail(message: GmailMessage) {
  const text = message.bodyText;
  
  const amountMatch = text.match(/(?:INR|Rs\.?)\s*([0-9,]+\.?[0-9]*)/i);
  const merchantMatch = text.match(/at\s+([A-Z0-9\s]+)/i);
  const cardMatch = text.match(/card\s+(?:ending\s+)?(\d{4})/i);
  
  if (!amountMatch || !cardMatch) {
    return null;
  }
  
  return {
    amount: parseFloat(amountMatch[1].replace(/,/g, '')),
    merchant: merchantMatch ? merchantMatch[1].trim() : 'Unknown Merchant',
    lastFourDigits: cardMatch[1],
    bankName: 'ICICI',
    transactionDate: new Date(),
    category: 'Others',
  };
}

/**
 * Parse Axis email
 */
function parseAxisEmail(message: GmailMessage) {
  const text = message.bodyText;
  
  const amountMatch = text.match(/(?:INR|Rs\.?)\s*([0-9,]+\.?[0-9]*)/i);
  const merchantMatch = text.match(/at\s+([A-Z0-9\s]+)/i);
  const cardMatch = text.match(/card\s+(?:ending\s+)?(\d{4})/i);
  
  if (!amountMatch || !cardMatch) {
    return null;
  }
  
  return {
    amount: parseFloat(amountMatch[1].replace(/,/g, '')),
    merchant: merchantMatch ? merchantMatch[1].trim() : 'Unknown Merchant',
    lastFourDigits: cardMatch[1],
    bankName: 'Axis',
    transactionDate: new Date(),
    category: 'Others',
  };
}
