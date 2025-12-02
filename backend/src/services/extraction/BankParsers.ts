import { DateParser } from './DateParser';

export interface ParsedTransaction {
  amount: number;
  merchant: string;
  lastFourDigits: string;
  bankName: string;
  transactionDate: Date;
  category: string;
  cardName?: string; // Optional specific card name hint
  transactionType?: 'purchase' | 'reversal' | 'refund' | 'emi' | 'international' | 'contactless';
  isInternational?: boolean;
  exactTimestamp?: Date;
  currencyCode?: string;
  originalAmount?: number;
  referenceNumber?: string;
}

export interface BankParser {
  name: string;
  bankName: string;
  identifiers: string[]; // Sender emails or subject keywords
  parse: (text: string, subject: string, sender: string, emailDate: Date) => ParsedTransaction | null;
}

const cleanAmount = (str: string) => parseFloat(str.replace(/,/g, ''));

/**
 * Enhanced merchant extraction with better patterns
 */
const extractMerchant = (text: string): string => {
  // Try multiple merchant patterns in order of specificity
  const patterns = [
    // Pattern 1: "at MERCHANT_NAME on"
    /(?:at|@)\s+([A-Za-z0-9\s*&.\-\/()]+?)(?:\s+on\s+(?:\d|[A-Za-z]{3})|\s+dated|\s+for\s+Rs|\.|,|\n|$)/i,
    // Pattern 2: "to MERCHANT_NAME on"
    /(?:to|towards)\s+([A-Za-z0-9\s*&.\-\/()]+?)(?:\s+on\s+(?:\d|[A-Za-z]{3})|\s+dated|\s+for\s+Rs|\.|,|\n|$)/i,
    // Pattern 3: "with MERCHANT_NAME"
    /(?:with)\s+([A-Za-z0-9\s*&.\-\/()]+?)(?:\s+on\s+(?:\d|[A-Za-z]{3})|\s+dated|\.|,|\n|$)/i,
    // Pattern 4: "from MERCHANT_NAME"
    /(?:from)\s+([A-Za-z0-9\s*&.\-\/()]+?)(?:\s+on\s+(?:\d|[A-Za-z]{3})|\s+dated|\.|,|\n|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const merchant = match[1].trim();
      // Filter out common false positives
      if (merchant.length > 2 && 
          !merchant.match(/^(your|card|credit|bank|transaction|purchase|payment|upi)$/i)) {
        return merchant;
      }
    }
  }

  return 'Unknown Merchant';
};

/**
 * Extract last 4 digits with multiple patterns
 */
const extractCardDigits = (text: string): string | null => {
  const patterns = [
    /(?:XX|xx)[\s*]*(\d{4})/i,
    /(?:ending|ending in|ends with|last 4 digits?)\s*(?:in)?\s*(\d{4})/i,
    /(?:card|no\.|number)[\s:]*(?:XX|xx)?[\s*]*(\d{4})/i,
    /(?:\*{4}|\*{6}|\*{8}|\*{12})(\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

/**
 * Detect transaction type from text
 */
const detectTransactionType = (text: string, subject: string): ParsedTransaction['transactionType'] => {
  const combined = (text + ' ' + subject).toLowerCase();
  
  if (combined.includes('refund') || combined.includes('credit') || combined.includes('reversed')) {
    return 'refund';
  }
  if (combined.includes('reversal')) {
    return 'reversal';
  }
  if (combined.includes('emi') || combined.includes('installment')) {
    return 'emi';
  }
  if (combined.includes('contactless') || combined.includes('tap')) {
    return 'contactless';
  }
  if (combined.includes('international') || combined.includes('foreign')) {
    return 'international';
  }
  
  return 'purchase';
};

/**
 * Check if transaction is international
 */
const isInternationalTransaction = (text: string, subject: string): boolean => {
  const combined = (text + ' ' + subject).toLowerCase();
  return combined.includes('international') || 
         combined.includes('foreign') || 
         combined.includes('usd') || 
         combined.includes('eur') || 
         combined.includes('gbp') ||
         combined.includes('abroad');
};

/**
 * Extract reference number
 */
const extractReferenceNumber = (text: string): string | undefined => {
  const patterns = [
    /(?:Ref No|Reference No|Txn Ref|Transaction ID|Ref|Txn ID)\b[:\s]*([A-Za-z0-9]+)/i,
    /(?:Ref\. No\.|Reference Number)[:\s]*([A-Za-z0-9]+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1];
  }
  return undefined;
};

/**
 * Extract currency code
 */
const extractCurrency = (text: string): string => {
  if (/USD|\$|Dollar/i.test(text)) return 'USD';
  if (/EUR|€|Euro/i.test(text)) return 'EUR';
  if (/GBP|£|Pound/i.test(text)) return 'GBP';
  return 'INR';
};

/**
 * Extract original amount for international transactions
 */
const extractOriginalAmount = (text: string): number | undefined => {
  const match = text.match(/(?:USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
  if (match && match[1]) {
    return cleanAmount(match[1]);
  }
  return undefined;
};

export const BankParsers: BankParser[] = [
  // ============================================================
  // SBI - State Bank of India
  // ============================================================
  {
    name: 'SBI',
    bankName: 'SBI',
    identifiers: ['sbi.co.in', 'sbicard.com', 'state bank of india', 'sbicard'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');
      
      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'SBI',
          transactionDate: emailDate,
          category: 'Others',
          cardName: 'SBI Cashback',
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // HDFC Bank
  // ============================================================
  {
    name: 'HDFC',
    bankName: 'HDFC',
    identifiers: ['hdfcbank.net', 'hdfcbank.com', 'hdfc'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      // Detect specific HDFC card types
      let cardNameHint = 'HDFC Credit Card';
      const combined = (text + ' ' + subject).toLowerCase();
      if (combined.includes('swiggy')) cardNameHint = 'HDFC Swiggy';
      else if (combined.includes('tata neu')) cardNameHint = 'HDFC Tata Neu';
      else if (combined.includes('moneyback')) cardNameHint = 'HDFC MoneyBack+';
      else if (combined.includes('regalia')) cardNameHint = 'HDFC Regalia';
      else if (combined.includes('diners')) cardNameHint = 'HDFC Diners Club';
      else if (combined.includes('millennia')) cardNameHint = 'HDFC Millennia';
      else if (combined.includes('infinia')) cardNameHint = 'HDFC Infinia';
      else if (combined.includes('upi') || combined.includes('rupay')) cardNameHint = 'HDFC UPI Rupay';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'HDFC',
          transactionDate: emailDate,
          category: 'Others',
          cardName: cardNameHint,
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // ICICI Bank
  // ============================================================
  {
    name: 'ICICI',
    bankName: 'ICICI',
    identifiers: ['icicibank.com', 'icici.com', 'icicibank.co.in', 'icici'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      // Detect specific ICICI card types
      let cardNameHint = 'ICICI Credit Card';
      const combined = (text + ' ' + subject).toLowerCase();
      if (combined.includes('amazon pay')) cardNameHint = 'ICICI Amazon Pay';
      else if (combined.includes('coral')) cardNameHint = 'ICICI Coral';
      else if (combined.includes('rubyx')) cardNameHint = 'ICICI Rubyx';
      else if (combined.includes('sapphiro')) cardNameHint = 'ICICI Sapphiro';
      else if (combined.includes('platinum')) cardNameHint = 'ICICI Platinum';
      else if (combined.includes('manchester')) cardNameHint = 'ICICI Manchester United';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'ICICI',
          transactionDate: emailDate,
          category: 'Others',
          cardName: cardNameHint,
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // Axis Bank
  // ============================================================
  {
    name: 'Axis',
    bankName: 'Axis',
    identifiers: ['axisbank.com', 'axisbank.co.in', 'axis'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      // Detect specific Axis card types
      let cardNameHint = 'Axis Credit Card';
      const combined = (text + ' ' + subject).toLowerCase();
      if (combined.includes('airtel')) cardNameHint = 'Airtel Axis Bank';
      else if (combined.includes('ace')) cardNameHint = 'Axis ACE';
      else if (combined.includes('flipkart')) cardNameHint = 'Axis Flipkart';
      else if (combined.includes('magnus')) cardNameHint = 'Axis Magnus';
      else if (combined.includes('vistara')) cardNameHint = 'Axis Vistara';
      else if (combined.includes('neo')) cardNameHint = 'Axis Neo';
      else if (combined.includes('privilege')) cardNameHint = 'Axis Privilege';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'Axis',
          transactionDate: emailDate,
          category: 'Others',
          cardName: cardNameHint,
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // Kotak Mahindra Bank
  // ============================================================
  {
    name: 'Kotak',
    bankName: 'Kotak',
    identifiers: ['kotak.com', 'kotakbank.com', 'kotak mahindra'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      // Detect specific Kotak card types
      let cardNameHint = 'Kotak Credit Card';
      const combined = (text + ' ' + subject).toLowerCase();
      if (combined.includes('811')) cardNameHint = 'Kotak 811';
      else if (combined.includes('myntra')) cardNameHint = 'Kotak Myntra';
      else if (combined.includes('league')) cardNameHint = 'Kotak League Platinum';
      else if (combined.includes('white')) cardNameHint = 'Kotak White Reserve';
      else if (combined.includes('essentia')) cardNameHint = 'Kotak Essentia';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'Kotak',
          transactionDate: emailDate,
          category: 'Others',
          cardName: cardNameHint,
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // IDFC First Bank
  // ============================================================
  {
    name: 'IDFC',
    bankName: 'IDFC',
    identifiers: ['idfcfirstbank.com', 'idfc'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      let cardNameHint = 'IDFC Credit Card';
      const combined = (text + ' ' + subject).toLowerCase();
      if (combined.includes('millennia') || combined.includes('millenia')) cardNameHint = 'IDFC First Millennia';
      else if (combined.includes('select')) cardNameHint = 'IDFC Select';
      else if (combined.includes('club vistara')) cardNameHint = 'IDFC Club Vistara';
      else if (combined.includes('upi') || combined.includes('rupay')) cardNameHint = 'IDFC UPI Rupay';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'IDFC',
          transactionDate: emailDate,
          category: 'Others',
          cardName: cardNameHint,
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // IndusInd Bank
  // ============================================================
  {
    name: 'IndusInd',
    bankName: 'IndusInd',
    identifiers: ['indusind.com', 'indusind'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      let cardNameHint = 'IndusInd Credit Card';
      const combined = (text + ' ' + subject).toLowerCase();
      if (combined.includes('legend')) cardNameHint = 'IndusInd Legend';
      else if (combined.includes('pinnacle')) cardNameHint = 'IndusInd Pinnacle';
      else if (combined.includes('iconia')) cardNameHint = 'IndusInd Iconia';
      else if (combined.includes('nexxt')) cardNameHint = 'IndusInd Nexxt';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'IndusInd',
          transactionDate: emailDate,
          category: 'Others',
          cardName: cardNameHint,
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // Yes Bank
  // ============================================================
  {
    name: 'YesBank',
    bankName: 'Yes Bank',
    identifiers: ['yesbank.in', 'yes bank'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      let cardNameHint = 'Yes Bank Credit Card';
      const combined = (text + ' ' + subject).toLowerCase();
      if (combined.includes('marquee')) cardNameHint = 'Yes Bank Marquee';
      else if (combined.includes('prosperity')) cardNameHint = 'Yes Bank Prosperity';
      else if (combined.includes('elite')) cardNameHint = 'Yes Bank Elite';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'Yes Bank',
          transactionDate: emailDate,
          category: 'Others',
          cardName: cardNameHint,
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // Standard Chartered Bank
  // ============================================================
  {
    name: 'StandardChartered',
    bankName: 'Standard Chartered',
    identifiers: ['sc.com', 'standardchartered.co.in', 'standard chartered'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      let cardNameHint = 'Standard Chartered Credit Card';
      const combined = (text + ' ' + subject).toLowerCase();
      if (combined.includes('manhattan')) cardNameHint = 'Standard Chartered Manhattan';
      else if (combined.includes('super value')) cardNameHint = 'Standard Chartered Super Value';
      else if (combined.includes('platinum')) cardNameHint = 'Standard Chartered Platinum';
      else if (combined.includes('ultimate')) cardNameHint = 'Standard Chartered Ultimate';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'Standard Chartered',
          transactionDate: emailDate,
          category: 'Others',
          cardName: cardNameHint,
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // Citibank
  // ============================================================
  {
    name: 'Citi',
    bankName: 'Citibank',
    identifiers: ['citibank.com', 'citi.com', 'citibank.co.in', 'citi'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      let cardNameHint = 'Citibank Credit Card';
      const combined = (text + ' ' + subject).toLowerCase();
      if (combined.includes('prestige')) cardNameHint = 'Citi Prestige';
      else if (combined.includes('premier miles')) cardNameHint = 'Citi PremierMiles';
      else if (combined.includes('rewards')) cardNameHint = 'Citi Rewards';
      else if (combined.includes('cashback')) cardNameHint = 'Citi Cashback';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'Citibank',
          transactionDate: emailDate,
          category: 'Others',
          cardName: cardNameHint,
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // American Express
  // ============================================================
  {
    name: 'AmEx',
    bankName: 'American Express',
    identifiers: ['americanexpress.com', 'amex.co.in', 'american express', 'amex'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      let cardNameHint = 'American Express';
      const combined = (text + ' ' + subject).toLowerCase();
      if (combined.includes('platinum')) cardNameHint = 'AmEx Platinum';
      else if (combined.includes('gold')) cardNameHint = 'AmEx Gold';
      else if (combined.includes('mrcc') || combined.includes('membership rewards')) cardNameHint = 'AmEx MRCC';
      else if (combined.includes('smart earn')) cardNameHint = 'AmEx Smart Earn';
      else if (combined.includes('centurion')) cardNameHint = 'AmEx Centurion';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'American Express',
          transactionDate: emailDate,
          category: 'Others',
          cardName: cardNameHint,
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // RBL Bank
  // ============================================================
  {
    name: 'RBL',
    bankName: 'RBL Bank',
    identifiers: ['rblbank.com', 'rbl bank'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      let cardNameHint = 'RBL Bank Credit Card';
      const combined = (text + ' ' + subject).toLowerCase();
      if (combined.includes('shoprite')) cardNameHint = 'RBL ShopRite';
      else if (combined.includes('platinum')) cardNameHint = 'RBL Platinum';
      else if (combined.includes('world safari')) cardNameHint = 'RBL World Safari';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'RBL Bank',
          transactionDate: emailDate,
          category: 'Others',
          cardName: cardNameHint,
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // AU Small Finance Bank
  // ============================================================
  {
    name: 'AUBank',
    bankName: 'AU Small Finance Bank',
    identifiers: ['aubank.in', 'au small finance'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      let cardNameHint = 'AU Bank Credit Card';
      const combined = (text + ' ' + subject).toLowerCase();
      if (combined.includes('altura')) cardNameHint = 'AU Altura';
      else if (combined.includes('lit')) cardNameHint = 'AU LIT';
      else if (combined.includes('zenith')) cardNameHint = 'AU Zenith';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'AU Small Finance Bank',
          transactionDate: emailDate,
          category: 'Others',
          cardName: cardNameHint,
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // Bank of Baroda (BOB)
  // ============================================================
  {
    name: 'BOB',
    bankName: 'Bank of Baroda',
    identifiers: ['bankofbaroda.in', 'bankofbaroda.com', 'bank of baroda'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      let cardNameHint = 'Bank of Baroda Credit Card';
      const combined = (text + ' ' + subject).toLowerCase();
      if (combined.includes('premier')) cardNameHint = 'BOB Premier';
      else if (combined.includes('eterna')) cardNameHint = 'BOB Eterna';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'Bank of Baroda',
          transactionDate: emailDate,
          category: 'Others',
          cardName: cardNameHint,
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // Canara Bank
  // ============================================================
  {
    name: 'Canara',
    bankName: 'Canara Bank',
    identifiers: ['canarabank.in', 'canara bank'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'Canara Bank',
          transactionDate: emailDate,
          category: 'Others',
          cardName: 'Canara Bank Credit Card',
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // Punjab National Bank (PNB)
  // ============================================================
  {
    name: 'PNB',
    bankName: 'Punjab National Bank',
    identifiers: ['pnbindia.in', 'pnb.co.in', 'punjab national bank'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      let cardNameHint = 'PNB Credit Card';
      const combined = (text + ' ' + subject).toLowerCase();
      if (combined.includes('rupay select')) cardNameHint = 'PNB RuPay Select';
      else if (combined.includes('platinum')) cardNameHint = 'PNB Platinum';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'Punjab National Bank',
          transactionDate: emailDate,
          category: 'Others',
          cardName: cardNameHint,
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // Jupiter (Federal Bank)
  // ============================================================
  {
    name: 'Jupiter',
    bankName: 'Jupiter',
    identifiers: ['jupiter.money', 'federalbank.co.in', 'jupiter'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'Jupiter',
          transactionDate: emailDate,
          category: 'Others',
          cardName: 'Jupiter Edge+',
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // HSBC Bank
  // ============================================================
  {
    name: 'HSBC',
    bankName: 'HSBC',
    identifiers: ['hsbc.co.in', 'hsbc.com', 'hsbc'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      let cardNameHint = 'HSBC Credit Card';
      const combined = (text + ' ' + subject).toLowerCase();
      if (combined.includes('platinum')) cardNameHint = 'HSBC Platinum';
      else if (combined.includes('cashback')) cardNameHint = 'HSBC Cashback';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'HSBC',
          transactionDate: emailDate,
          category: 'Others',
          cardName: cardNameHint,
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // Union Bank of India
  // ============================================================
  {
    name: 'UnionBank',
    bankName: 'Union Bank of India',
    identifiers: ['unionbankofindia.co.in', 'union bank'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'Union Bank of India',
          transactionDate: emailDate,
          category: 'Others',
          cardName: 'Union Bank Credit Card',
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // Bank of India
  // ============================================================
  {
    name: 'BOI',
    bankName: 'Bank of India',
    identifiers: ['bankofindia.co.in', 'bank of india'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'Bank of India',
          transactionDate: emailDate,
          category: 'Others',
          cardName: 'Bank of India Credit Card',
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // Federal Bank
  // ============================================================
  {
    name: 'Federal',
    bankName: 'Federal Bank',
    identifiers: ['federalbank.co.in', 'federal bank'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      let cardNameHint = 'Federal Bank Credit Card';
      const combined = (text + ' ' + subject).toLowerCase();
      if (combined.includes('celesta')) cardNameHint = 'Federal Celesta';
      else if (combined.includes('platinum')) cardNameHint = 'Federal Platinum';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'Federal Bank',
          transactionDate: emailDate,
          category: 'Others',
          cardName: cardNameHint,
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // OneCard (Federal Bank / CSB Bank / South Indian Bank)
  // ============================================================
  {
    name: 'OneCard',
    bankName: 'OneCard',
    identifiers: ['getonecard.app', 'onecard'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'OneCard',
          transactionDate: emailDate,
          category: 'Others',
          cardName: 'OneCard',
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // Slice (North East Small Finance Bank)
  // ============================================================
  {
    name: 'Slice',
    bankName: 'Slice',
    identifiers: ['sliceit.com', 'slice'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'Slice',
          transactionDate: emailDate,
          category: 'Others',
          cardName: 'Slice Credit Card',
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },

  // ============================================================
  // Fi Money (Federal Bank)
  // ============================================================
  {
    name: 'FiMoney',
    bankName: 'Fi Money',
    identifiers: ['fi.money', 'fimoney'],
    parse: (text, subject, sender, emailDate) => {
      const cleanText = text.replace(/linked to UPI/i, '').replace(/\s+/g, ' ');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR|₹)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = extractCardDigits(cleanText);
      const merchant = extractMerchant(cleanText);

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant,
          lastFourDigits: cardMatch,
          bankName: 'Fi Money',
          transactionDate: emailDate,
          category: 'Others',
          cardName: 'Fi Credit Card',
          transactionType: detectTransactionType(text, subject),
          isInternational: isInternationalTransaction(text, subject),
          exactTimestamp: DateParser.extractDateTime(text) || emailDate,
          referenceNumber: extractReferenceNumber(text),
          currencyCode: extractCurrency(text),
          originalAmount: extractOriginalAmount(text),
        };
      }
      return null;
    }
  },
];
