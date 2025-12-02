import { gmail_v1 } from 'googleapis';

export type EmailCategory =
  | 'transaction_success'
  | 'refund'
  | 'payment_success'
  | 'payment_reminder'
  | 'payment_declined'
  | 'statement_generated'
  | 'statement_reminder'
  | 'otp'
  | 'card_activation'
  | 'limit_change'
  | 'reward_update'
  | 'emi_conversion'
  | 'auto_debit'
  | 'card_block'
  | 'unknown';

export interface DetectionResult {
  isTransaction: boolean; // True only for transaction_success and refund
  category: EmailCategory;
  confidence: number;
  reason?: string;
  hasPdf?: boolean;
}

export class CreditCardMailDetector {
  // Configurable rules
  public static readonly SENDER_DOMAINS = [
    // Universal new government-mandated domain
    ".bank.in",

    // HDFC
    "hdfcbank.com", "hdfcbank.net",

    // SBI + SBI Card
    "sbi.co.in", "sbicard.com",

    // ICICI
    "icicibank.com", "icicibank.in",

    // Axis
    "axisbank.com", "axisbank.co.in",

    // IDFC FIRST
    "idfcfirstbank.com",

    // IndusInd
    "indusind.com", "indusindbank.in",

    // Citi India
    "citibank.com", "citi.com",

    // Amex
    "americanexpress.com", "aexp.com",

    // HSBC
    "hsbc.co.in",

    // Kotak
    "kotak.com", "kotak.in",

    // RBL
    "rblbank.com",

    // Standard Chartered
    "sc.com", "in.sc.com",

    // Yes Bank
    "yesbank.in",

    // Federal Bank
    "federalbank.co.in", "federalbank.in",

    // AU Small Finance Bank
    "aubank.in",

    // Bank of Baroda
    "bankofbaroda.com", "bankofbaroda.in",

    // Canara Bank
    "canarabank.in",

    // PNB
    "pnbindia.in", "pnb.co.in",

    // Union Bank
    "unionbankofindia.co.in",

    // Bank of India
    "bankofindia.co.in",

    // IDBI
    "idbibank.in",

    // DBS
    "dbs.com"
  ];


  private static readonly CATEGORY_RULES: Record<EmailCategory, RegExp[]> = {
    transaction_success: [
      /transaction alert/i, /spent/i, /purchase/i, /debited/i, /charged/i,
      /transaction notification/i, /transaction of/i, /spent on/i, /thank you for using/i
    ],
    refund: [
      /refund/i, /reversal/i, /reversed/i, /credited/i, /credit adjustment/i
    ],
    payment_success: [
      /payment received/i, /payment confirmation/i, /payment successful/i,
      /thank you for your payment/i, /payment credited/i
    ],
    payment_reminder: [
      /payment due/i, /bill due/i, /payment reminder/i, /outstanding/i, /pay now/i
    ],
    payment_declined: [
      /payment declined/i, /transaction declined/i, /payment failed/i, /transaction failed/i
    ],
    statement_generated: [
      /statement generated/i, /e-statement/i, /monthly statement/i, /account statement/i
    ],
    statement_reminder: [
      /download statement/i, /view statement/i, /check statement/i
    ],
    otp: [
      /otp/i, /one time password/i, /verification code/i, /authentication code/i
    ],
    card_activation: [
      /card activated/i, /card delivered/i, /card dispatched/i, /welcome to/i
    ],
    limit_change: [
      /limit increase/i, /limit decrease/i, /limit changed/i, /limit enhancement/i
    ],
    reward_update: [
      /reward points/i, /points balance/i, /points expiring/i, /points redeemed/i
    ],
    emi_conversion: [
      /emi conversion/i, /converted to emi/i, /merchant emi/i
    ],
    auto_debit: [
      /auto debit/i, /standing instruction/i, /autopay/i
    ],
    card_block: [
      /card blocked/i, /card unblocked/i, /block your card/i
    ],
    unknown: []
  };

  /**
   * Detect if an email is a credit card transaction email
   */
  static detect(message: gmail_v1.Schema$Message): DetectionResult {
    const headers = message.payload?.headers || [];
    const fromHeader = headers.find(h => h.name === 'From')?.value || '';
    const subjectHeader = headers.find(h => h.name === 'Subject')?.value || '';
    const snippet = message.snippet || '';

    // 1. Check Sender
    const isBankSender = this.SENDER_DOMAINS.some(domain => fromHeader.toLowerCase().includes(domain));

    if (!isBankSender) {
      // Allow some flexibility if subject is very strong, but generally require bank sender
      const isStrongSubject = /transaction alert|credit card statement|spent|debited/i.test(subjectHeader);
      if (!isStrongSubject) {
        return {
          isTransaction: false,
          category: 'unknown',
          confidence: 0.0,
          reason: 'Not a bank sender'
        };
      }
    }

    // 2. Classify Category
    const combinedText = `${subjectHeader} ${snippet}`.toLowerCase();
    let bestCategory: EmailCategory = 'unknown';
    let maxMatches = 0;

    // Prioritize transaction_success and refund
    const priorityCategories: EmailCategory[] = ['transaction_success', 'refund'];

    // Check priority categories first
    for (const category of priorityCategories) {
      const rules = this.CATEGORY_RULES[category];
      const matches = rules.filter(regex => regex.test(combinedText)).length;
      if (matches > 0) {
        bestCategory = category;
        maxMatches = matches;
        break; // Stop if we find a transaction or refund
      }
    }

    // If no priority category found, check others
    if (bestCategory === 'unknown') {
      for (const [category, rules] of Object.entries(this.CATEGORY_RULES)) {
        if (priorityCategories.includes(category as EmailCategory)) continue;

        const matches = rules.filter(regex => regex.test(combinedText)).length;
        if (matches > maxMatches) {
          maxMatches = matches;
          bestCategory = category as EmailCategory;
        }
      }
    }

    // 3. Check Attachments (PDFs often are statements)
    const parts = message.payload?.parts || [];
    const hasPdf = parts.some(part => part.mimeType === 'application/pdf' || part.filename?.toLowerCase().endsWith('.pdf'));

    // Refine classification based on PDF
    if (bestCategory === 'unknown' && hasPdf) {
      if (/statement/i.test(combinedText)) {
        bestCategory = 'statement_generated';
      }
    }

    // 4. Determine if Displayable Transaction
    const isTransaction = bestCategory === 'transaction_success' || bestCategory === 'refund';

    // Calculate confidence
    let confidence = 0.5;
    if (isBankSender) confidence += 0.2;
    if (maxMatches > 0) confidence += 0.2;
    if (maxMatches > 1) confidence += 0.1;

    return {
      isTransaction,
      category: bestCategory,
      confidence: Math.min(confidence, 1.0),
      reason: `Classified as ${bestCategory} with ${maxMatches} signal matches`,
      hasPdf
    };
  }
}
