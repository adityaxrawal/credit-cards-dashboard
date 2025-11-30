import { DateParser } from './DateParser';

export interface ParsedTransaction {
  amount: number;
  merchant: string;
  lastFourDigits: string;
  bankName: string;
  transactionDate: Date;
  category: string;
  cardName?: string; // Optional specific card name hint
}

export interface BankParser {
  name: string;
  bankName: string;
  identifiers: string[]; // Sender emails or subject keywords
  parse: (text: string, subject: string, sender: string) => ParsedTransaction | null;
}

const cleanAmount = (str: string) => parseFloat(str.replace(/,/g, ''));

export const BankParsers: BankParser[] = [
  // 1. SBI Cashback
  {
    name: 'SBI',
    bankName: 'SBI',
    identifiers: ['sbi.co.in', 'sbicard.com', 'state bank of india'],
    parse: (text, subject) => {
      // Pattern: Rs. 1,234.00 spent on SBI Credit Card ending 1234 at AMAZON on 14/11/23
      const amountMatch = text.match(/(?:Rs\.?|INR)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = text.match(/(?:ending|no\.)\s*(?:in)?\s*(\d{4})/i);
      const merchantMatch = text.match(/(?:at|to|towards)\s+([A-Za-z0-9\s*&.-]+?)(?:\s+on|\.|\n|$)/i);
      const dateMatch = DateParser.extract(text) || DateParser.extract(subject);

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant: merchantMatch ? merchantMatch[1].trim() : 'Unknown Merchant',
          lastFourDigits: cardMatch[1],
          bankName: 'SBI',
          transactionDate: dateMatch || new Date(),
          category: 'Others',
          cardName: 'SBI Cashback' // Hint
        };
      }
      return null;
    }
  },

  // 2-5. HDFC (Swiggy, UPI Rupay, Tata Neu, MoneyBack+)
  {
    name: 'HDFC',
    bankName: 'HDFC',
    identifiers: ['hdfcbank.net', 'hdfcbank.com'],
    parse: (text, subject) => {
      // HDFC often sends: "Rs 1234.00 was spent on your Credit Card XX1234 at SWIGGY on 14-11-2023"
      // Also UPI: "Rs 500.00 debited from HDFC Bank Credit Card XX1234 linked to UPI"
      
      // Remove "linked to UPI" to avoid confusion with "to"
      const cleanText = text.replace(/linked to UPI/i, '');

      const amountMatch = cleanText.match(/(?:Rs\.?|INR)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = cleanText.match(/(?:XX|xx|ending\s+)(\d{4})/i);
      const merchantMatch = cleanText.match(/(?:at|to|towards)\s+([A-Za-z0-9\s*&.-]+?)(?:\s+on|\.|\n|$)/i);
      const dateMatch = DateParser.extract(cleanText) || DateParser.extract(subject);

      // Detect specific card types from text if possible
      let cardNameHint = 'HDFC Credit Card';
      if (text.includes('Swiggy') || subject.includes('Swiggy')) cardNameHint = 'HDFC Swiggy';
      else if (text.includes('Tata Neu') || subject.includes('Tata Neu')) cardNameHint = 'HDFC Tata Neu';
      else if (text.includes('MoneyBack') || subject.includes('MoneyBack')) cardNameHint = 'HDFC MoneyBack+';
      else if (text.includes('UPI') || text.includes('Rupay')) cardNameHint = 'HDFC UPI Rupay';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant: merchantMatch ? merchantMatch[1].trim() : 'Unknown Merchant',
          lastFourDigits: cardMatch[1],
          bankName: 'HDFC',
          transactionDate: dateMatch || new Date(),
          category: 'Others',
          cardName: cardNameHint
        };
      }
      return null;
    }
  },

  // 6. Airtel Axis Bank
  {
    name: 'Axis',
    bankName: 'Axis',
    identifiers: ['axisbank.com', 'axisbank.co.in'],
    parse: (text, subject) => {
      const amountMatch = text.match(/(?:Rs\.?|INR)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = text.match(/(?:XX|xx|ending\s+)(\d{4})/i);
      const merchantMatch = text.match(/(?:at|to|towards)\s+([A-Za-z0-9\s*&.-]+?)(?:\s+on|\.|\n|$)/i);
      const dateMatch = DateParser.extract(text) || DateParser.extract(subject);

      let cardNameHint = 'Axis Credit Card';
      if (text.includes('Airtel') || subject.includes('Airtel')) cardNameHint = 'Airtel Axis Bank';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant: merchantMatch ? merchantMatch[1].trim() : 'Unknown Merchant',
          lastFourDigits: cardMatch[1],
          bankName: 'Axis',
          transactionDate: dateMatch || new Date(),
          category: 'Others',
          cardName: cardNameHint
        };
      }
      return null;
    }
  },

  // 7-8. IDFC (Millennial, UPI Rupay)
  {
    name: 'IDFC',
    bankName: 'IDFC',
    identifiers: ['idfcfirstbank.com'],
    parse: (text, subject) => {
      const amountMatch = text.match(/(?:Rs\.?|INR)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = text.match(/(?:XX|xx|ending\s+)(\d{4})/i);
      const merchantMatch = text.match(/(?:at|to|towards)\s+([A-Za-z0-9\s*&.-]+?)(?:\s+on|\.|\n|$)/i);
      const dateMatch = DateParser.extract(text) || DateParser.extract(subject);

      let cardNameHint = 'IDFC Credit Card';
      if (text.includes('Millennia') || subject.includes('Millennia')) cardNameHint = 'IDFC First Millennial';
      else if (text.includes('UPI') || text.includes('Rupay')) cardNameHint = 'IDFC UPI Rupay';

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant: merchantMatch ? merchantMatch[1].trim() : 'Unknown Merchant',
          lastFourDigits: cardMatch[1],
          bankName: 'IDFC',
          transactionDate: dateMatch || new Date(),
          category: 'Others',
          cardName: cardNameHint
        };
      }
      return null;
    }
  },

  // 9. IndusInd Legend
  {
    name: 'IndusInd',
    bankName: 'IndusInd',
    identifiers: ['indusind.com'],
    parse: (text, subject) => {
      const amountMatch = text.match(/(?:Rs\.?|INR)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = text.match(/(?:XX|xx|ending\s+)(\d{4})/i);
      const merchantMatch = text.match(/(?:at|to|towards)\s+([A-Za-z0-9\s*&.-]+?)(?:\s+on|\.|\n|$)/i);
      const dateMatch = DateParser.extract(text) || DateParser.extract(subject);

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant: merchantMatch ? merchantMatch[1].trim() : 'Unknown Merchant',
          lastFourDigits: cardMatch[1],
          bankName: 'IndusInd',
          transactionDate: dateMatch || new Date(),
          category: 'Others',
          cardName: 'IndusInd Legend'
        };
      }
      return null;
    }
  },

  // 10. Yes Bank POP
  {
    name: 'YesBank',
    bankName: 'Yes Bank',
    identifiers: ['yesbank.in'],
    parse: (text, subject) => {
      const amountMatch = text.match(/(?:Rs\.?|INR)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = text.match(/(?:XX|xx|ending\s+)(\d{4})/i);
      const merchantMatch = text.match(/(?:at|to|towards)\s+([A-Za-z0-9\s*&.-]+?)(?:\s+on|\.|\n|$)/i);
      const dateMatch = DateParser.extract(text) || DateParser.extract(subject);

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant: merchantMatch ? merchantMatch[1].trim() : 'Unknown Merchant',
          lastFourDigits: cardMatch[1],
          bankName: 'Yes Bank',
          transactionDate: dateMatch || new Date(),
          category: 'Others',
          cardName: 'Yes Bank POP'
        };
      }
      return null;
    }
  },

  // 11. Jupiter Edge+
  {
    name: 'Jupiter',
    bankName: 'Jupiter',
    identifiers: ['jupiter.money', 'federalbank.co.in'], // Jupiter is backed by Federal Bank
    parse: (text, subject) => {
      const amountMatch = text.match(/(?:Rs\.?|INR)\s*([0-9,]+\.?[0-9]*)/i);
      const cardMatch = text.match(/(?:XX|xx|ending\s+)(\d{4})/i);
      const merchantMatch = text.match(/(?:at|to|towards)\s+([A-Za-z0-9\s*&.-]+?)(?:\s+on|\.|\n|$)/i);
      const dateMatch = DateParser.extract(text) || DateParser.extract(subject);

      if (amountMatch && cardMatch) {
        return {
          amount: cleanAmount(amountMatch[1]),
          merchant: merchantMatch ? merchantMatch[1].trim() : 'Unknown Merchant',
          lastFourDigits: cardMatch[1],
          bankName: 'Jupiter',
          transactionDate: dateMatch || new Date(),
          category: 'Others',
          cardName: 'Jupiter Edge+'
        };
      }
      return null;
    }
  }
];
