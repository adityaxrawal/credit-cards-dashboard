import { EMAIL_PATTERNS, STATEMENT_PATTERNS, TRANSACTION_CATEGORIES, EmailPattern } from '../email-patterns';

export interface ParsedEmail {
  bank: string;
  type: 'transaction' | 'statement';
  cardNumber?: string;
  amount?: number;
  merchant?: string;
  date?: Date;
  transactionType?: 'debit' | 'credit' | 'reversal';
  category?: string;
  raw: {
    subject: string;
    body: string;
    sender: string;
  };
}

export interface ParsedTransaction {
  cardNumber: string;
  amount: number;
  merchant: string;
  date: Date;
  type: 'debit' | 'credit' | 'reversal';
  category: string;
  bank: string;
  description: string;
}

export interface ParsedStatement {
  cardNumber: string;
  bank: string;
  statementDate: Date;
  dueDate?: Date;
  totalDue?: number;
  minimumDue?: number;
  availableCredit?: number;
  creditLimit?: number;
}

export class EmailParserService {
  private patterns: EmailPattern[];
  private statementPatterns: EmailPattern[];

  constructor() {
    this.patterns = EMAIL_PATTERNS;
    this.statementPatterns = STATEMENT_PATTERNS;
  }

  /**
   * Parse an email and determine if it's a transaction or statement
   */
  parseEmail(email: {
    subject: string;
    body: string;
    sender: string;
    date: Date;
  }): ParsedEmail | null {
    try {
      // First, identify the bank
      const bank = this.identifyBank(email.sender);
      if (!bank) {
        return null;
      }

      // Determine if it's a transaction or statement email
      const isStatement = this.isStatementEmail(email.subject, email.body);
      
      if (isStatement) {
        const statement = this.parseStatement(email);
        if (statement) {
          return {
            bank: statement.bank,
            type: 'statement',
            cardNumber: statement.cardNumber,
            amount: statement.totalDue,
            date: statement.dueDate,
            raw: {
              subject: email.subject,
              body: email.body,
              sender: email.sender
            }
          };
        }
      } else {
        const transaction = this.parseTransaction(email);
        if (transaction) {
          return {
            bank: transaction.bank,
            type: 'transaction',
            cardNumber: transaction.cardNumber,
            amount: transaction.amount,
            merchant: transaction.merchant,
            date: transaction.date,
            transactionType: transaction.type,
            category: transaction.category,
            raw: {
              subject: email.subject,
              body: email.body,
              sender: email.sender
            }
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error parsing email:', error);
      return null;
    }
  }

  /**
   * Parse transaction details from email
   */
  parseTransaction(email: {
    subject: string;
    body: string;
    sender: string;
    date: Date;
  }): ParsedTransaction | null {
    try {
      const bank = this.identifyBank(email.sender);
      if (!bank) return null;

      const pattern = this.patterns.find(p => p.bank === bank);
      if (!pattern) return null;

      const content = `${email.subject} ${email.body}`;

      // Extract card number
      const cardMatch = content.match(pattern.cardRegex);
      const cardNumber = cardMatch ? cardMatch[1] : '';

      // Extract amount
      const amountMatch = content.match(pattern.amountRegex);
      const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

      // Extract merchant
      const merchantMatch = content.match(pattern.merchantRegex);
      const merchant = merchantMatch ? merchantMatch[1].trim() : '';

      // Extract date
      const dateMatch = content.match(pattern.dateRegex);
      let transactionDate = email.date;
      if (dateMatch) {
        transactionDate = this.parseDate(dateMatch[1]);
      }

      // Determine transaction type
      const transactionType = this.determineTransactionType(content, pattern);

      // Categorize transaction
      const category = this.categorizeTransaction(merchant, content);

      if (!cardNumber || !amount) {
        return null;
      }

      return {
        cardNumber,
        amount,
        merchant,
        date: transactionDate,
        type: transactionType,
        category,
        bank,
        description: `${transactionType.toUpperCase()} - ${merchant} - ${amount}`
      };
    } catch (error) {
      console.error('Error parsing transaction:', error);
      return null;
    }
  }

  /**
   * Parse statement details from email
   */
  parseStatement(email: {
    subject: string;
    body: string;
    sender: string;
    date: Date;
  }): ParsedStatement | null {
    try {
      const bank = this.identifyBank(email.sender);
      if (!bank) return null;

      const pattern = this.statementPatterns.find(p => p.bank === bank);
      if (!pattern) return null;

      const content = `${email.subject} ${email.body}`;

      // Extract card number
      const cardMatch = content.match(pattern.cardRegex);
      const cardNumber = cardMatch ? cardMatch[1] : '';

      // Extract total due amount
      const amountMatch = content.match(pattern.amountRegex);
      const totalDue = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : undefined;

      // Extract due date
      const dateMatch = content.match(pattern.dateRegex);
      const dueDate = dateMatch ? this.parseDate(dateMatch[1]) : undefined;

      // Extract other statement details (these patterns would need to be more specific)
      const minimumDueMatch = content.match(/(?:Minimum Due|Min\. Due).*?(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})/i);
      const minimumDue = minimumDueMatch ? parseFloat(minimumDueMatch[1].replace(/,/g, '')) : undefined;

      const creditLimitMatch = content.match(/(?:Credit Limit|Available Limit).*?(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})/i);
      const creditLimit = creditLimitMatch ? parseFloat(creditLimitMatch[1].replace(/,/g, '')) : undefined;

      if (!cardNumber) {
        return null;
      }

      return {
        cardNumber,
        bank,
        statementDate: email.date,
        dueDate,
        totalDue,
        minimumDue,
        creditLimit,
        availableCredit: creditLimit && totalDue ? creditLimit - totalDue : undefined
      };
    } catch (error) {
      console.error('Error parsing statement:', error);
      return null;
    }
  }

  /**
   * Categorize transaction based on merchant and content
   */
  categorizeTransaction(merchant: string, content: string): string {
    const merchantLower = merchant.toLowerCase();
    const contentLower = content.toLowerCase();

    for (const [category, keywords] of Object.entries(TRANSACTION_CATEGORIES)) {
      for (const keyword of keywords) {
        if (merchantLower.includes(keyword.toLowerCase()) || 
            contentLower.includes(keyword.toLowerCase())) {
          return category;
        }
      }
    }

    return 'Others';
  }

  /**
   * Identify bank from sender email
   */
  private identifyBank(sender: string): string | null {
    for (const pattern of this.patterns) {
      for (const regex of pattern.senderRegex) {
        if (regex.test(sender)) {
          return pattern.bank;
        }
      }
    }
    return null;
  }

  /**
   * Determine if email is a statement email
   */
  private isStatementEmail(subject: string, body: string): boolean {
    const content = `${subject} ${body}`.toLowerCase();
    const statementKeywords = ['statement', 'monthly statement', 'credit card statement', 'bill generated', 'bill due'];
    
    return statementKeywords.some(keyword => content.includes(keyword));
  }

  /**
   * Determine transaction type (debit/credit/reversal)
   */
  private determineTransactionType(content: string, pattern: EmailPattern): 'debit' | 'credit' | 'reversal' {
    const contentLower = content.toLowerCase();

    // Check for reversal first (most specific)
    for (const keyword of pattern.typeKeywords.reversal) {
      if (contentLower.includes(keyword.toLowerCase())) {
        return 'reversal';
      }
    }

    // Check for credit
    for (const keyword of pattern.typeKeywords.credit) {
      if (contentLower.includes(keyword.toLowerCase())) {
        return 'credit';
      }
    }

    // Check for debit
    for (const keyword of pattern.typeKeywords.debit) {
      if (contentLower.includes(keyword.toLowerCase())) {
        return 'debit';
      }
    }

    // Default to debit if no specific keywords found
    return 'debit';
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateString: string): Date {
    try {
      // Handle different date formats
      if (dateString.includes('-')) {
        // Handle DD-MMM-YYYY or DD-MM-YYYY format
        if (dateString.match(/\d{2}-\w{3}-\d{4}/)) {
          // DD-MMM-YYYY format
          const parts = dateString.split('-');
          const monthMap: { [key: string]: number } = {
            'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
            'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
          };
          const month = monthMap[parts[1].toLowerCase()];
          return new Date(parseInt(parts[2]), month, parseInt(parts[0]));
        } else {
          // DD-MM-YYYY format
          const parts = dateString.split('-');
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      } else if (dateString.includes('/')) {
        // Handle DD/MM/YYYY format
        const parts = dateString.split('/');
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
      
      // Fallback to Date constructor
      return new Date(dateString);
    } catch (error) {
      console.error('Error parsing date:', dateString, error);
      return new Date();
    }
  }

  /**
   * Get all supported banks
   */
  getSupportedBanks(): string[] {
    return this.patterns.map(p => p.bank);
  }

  /**
   * Get pattern for specific bank
   */
  getPatternForBank(bank: string): EmailPattern | undefined {
    return this.patterns.find(p => p.bank === bank);
  }

  /**
   * Validate email format for parsing
   */
  validateEmailFormat(email: {
    subject: string;
    body: string;
    sender: string;
    date: Date;
  }): boolean {
    return !!(email.subject && email.body && email.sender && email.date);
  }
}