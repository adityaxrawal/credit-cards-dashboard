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

  // Weighted scoring for transaction detection
  private static readonly WEIGHTED_KEYWORDS: { positive: Record<string, number>; negative: Record<string, number> } = {
    positive: {
      'transaction alert': 15,
      'transaction notification': 15,
      'charged': 10,
      'spent': 10,
      'debited': 10,
      'purchase': 8,
      'bought': 8,
      'transaction of': 8,
      'spent on': 8,
      'rs.': 5,
      'inr': 5,
      '₹': 5,
      'at merchant': 5,
      'refund': 8,
      'reversal': 8,
      'credited': 5,
    },
    negative: {
      'otp': -50,
      'one time password': -50,
      'verification code': -40,
      'authentication code': -40,
      'statement generated': -30,
      'e-statement': -30,
      'monthly statement': -25,
      'account statement': -25,
      'payment received': -20,
      'payment confirmation': -20,
      'payment successful': -20,
      'thank you for your payment': -20,
      'payment credited': -15,
      'reward points': -15,
      'points balance': -10,
      'download statement': -15,
      'view statement': -15,
      'bill due': -10,
      'payment reminder': -10,
      'card activated': -10,
      'welcome to': -10,
    }
  };

  private static readonly TRANSACTION_THRESHOLD = 15;

  /**
   * Calculate weighted score for transaction classification
   */
  private static calculateScore(text: string): { score: number; matchedKeywords: string[] } {
    const lowerText = text.toLowerCase();
    let score = 0;
    const matchedKeywords: string[] = [];

    // Check positive keywords
    for (const [keyword, weight] of Object.entries(this.WEIGHTED_KEYWORDS.positive)) {
      if (lowerText.includes(keyword)) {
        score += weight;
        matchedKeywords.push(`+${keyword}(${weight})`);
      }
    }

    // Check negative keywords
    for (const [keyword, weight] of Object.entries(this.WEIGHTED_KEYWORDS.negative)) {
      if (lowerText.includes(keyword)) {
        score += weight; // weight is already negative
        matchedKeywords.push(`${keyword}(${weight})`);
      }
    }

    return { score, matchedKeywords }
  };

  /**
   * Detect if an email is a credit card transaction email
   * Uses weighted scoring system for accurate classification
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
        console.log('[Detector] Rejected - Not a bank sender:', fromHeader.substring(0, 50));
        return {
          isTransaction: false,
          category: 'unknown',
          confidence: 0.0,
          reason: 'Not a bank sender'
        };
      }
    }

    // 2. Calculate weighted score for transaction detection
    const combinedText = `${subjectHeader} ${snippet}`;
    const { score, matchedKeywords } = this.calculateScore(combinedText);

    // 3. Classify Category using existing rules
    const combinedLower = combinedText.toLowerCase();
    let bestCategory: EmailCategory = 'unknown';
    let maxMatches = 0;

    // Check all categories
    for (const [category, rules] of Object.entries(this.CATEGORY_RULES)) {
      const matches = rules.filter(regex => regex.test(combinedLower)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestCategory = category as EmailCategory;
      }
    }

    // 4. Check Attachments (PDFs often are statements)
    const parts = message.payload?.parts || [];
    const hasPdf = parts.some(part => part.mimeType === 'application/pdf' || part.filename?.toLowerCase().endsWith('.pdf'));

    // Refine classification based on PDF
    if (bestCategory === 'unknown' && hasPdf) {
      if (/statement/i.test(combinedLower)) {
        bestCategory = 'statement_generated';
      }
    }

    // 5. CRITICAL: Explicit exclusions - these categories are NEVER transactions
    const excludedCategories: EmailCategory[] = [
      'otp',
      'statement_generated',
      'statement_reminder',
      'payment_success',
      'payment_reminder',
      'card_activation',
      'reward_update'
    ];

    // 6. Determine if processable transaction using BOTH category AND score
    let isTransaction = false;

    if (excludedCategories.includes(bestCategory)) {
      // Explicitly excluded categories - never a transaction
      isTransaction = false;
    } else if (bestCategory === 'transaction_success' || bestCategory === 'refund') {
      // Primary transaction categories - use score threshold for confirmation
      isTransaction = score >= this.TRANSACTION_THRESHOLD;
    } else if (score >= this.TRANSACTION_THRESHOLD) {
      // High score but unknown/other category - might be a transaction
      isTransaction = true;
      if (bestCategory === 'unknown') {
        bestCategory = 'transaction_success'; // Upgrade category
      }
    }

    // Calculate confidence based on score and matches
    let confidence = 0.3;
    if (isBankSender) confidence += 0.2;
    if (score >= this.TRANSACTION_THRESHOLD) confidence += 0.3;
    if (maxMatches > 0) confidence += 0.1;
    if (maxMatches > 1) confidence += 0.1;

    // Debug logging
    console.log(`[Detector] Score: ${score} | Category: ${bestCategory} | isTransaction: ${isTransaction} | Keywords: ${matchedKeywords.slice(0, 5).join(', ')}`);

    return {
      isTransaction,
      category: bestCategory,
      confidence: Math.min(confidence, 1.0),
      reason: `Score: ${score}, Category: ${bestCategory}, Matches: ${maxMatches}`,
      hasPdf
    };
  }
}
