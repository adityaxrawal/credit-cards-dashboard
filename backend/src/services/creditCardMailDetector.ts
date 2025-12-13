import { gmail_v1 } from 'googleapis';
import { SimplifiedEmail } from '../types';

export type EmailCategory =
  | 'transaction_debit'
  | 'transaction_refund'
  | 'transaction_credit'
  | 'payment_success'
  | 'statement'
  | 'otp'
  | 'promotional'
  | 'alert'
  | 'unknown';

export interface DetectionResult {
  isTransaction: boolean;
  category: EmailCategory;
  confidence: number;
  reason: string;
  shouldProcess: boolean;
  hasPdf?: boolean;
}

export class CreditCardMailDetector {
  public static readonly SENDER_DOMAINS = [
    ".bank.in",
    "hdfcbank.com", "hdfcbank.net",
    "sbi.co.in", "sbicard.com",
    "icicibank.com", "icicibank.in",
    "axisbank.com", "axisbank.co.in",
    "idfcfirstbank.com",
    "indusind.com", "indusindbank.in",
    "citibank.com", "citi.com",
    "americanexpress.com", "aexp.com",
    "hsbc.co.in",
    "kotak.com", "kotak.in",
    "rblbank.com",
    "sc.com", "in.sc.com",
    "yesbank.in",
    "federalbank.co.in", "federalbank.in",
    "aubank.in",
    "bankofbaroda.com", "bankofbaroda.in",
    "canarabank.in",
    "pnbindia.in", "pnb.co.in",
    "unionbankofindia.co.in",
    "bankofindia.co.in",
    "idbibank.in",
    "dbs.com"
  ];

  /**
   * Detect if email is a transaction AND should be processed
   * ONLY returns shouldProcess=true for debit and refund transactions
   */
  static detect(message: SimplifiedEmail | gmail_v1.Schema$Message): DetectionResult {
    // Normalize input to SimplifiedEmail-like structure for internal methods
    const email: SimplifiedEmail = this.normalizeEmail(message);

    const isBankSender = this.SENDER_DOMAINS.some(domain => email.from.toLowerCase().includes(domain));

    // Check for OTP/2FA patterns FIRST (highest priority to exclude)
    if (this.isOtpEmail(email)) {
      return {
        isTransaction: false,
        category: 'otp',
        confidence: 0.95,
        reason: 'OTP/2FA email detected',
        shouldProcess: false
      };
    }

    // Check for payment success (bill payment, not purchase)
    if (this.isPaymentSuccess(email)) {
      return {
        isTransaction: false,
        category: 'payment_success',
        confidence: 0.90,
        reason: 'Bill payment email, not a purchase transaction',
        shouldProcess: false
      };
    }

    // Check for statement PDF
    if (this.isStatementPdf(email)) {
      return {
        isTransaction: false,
        category: 'statement',
        confidence: 0.95,
        reason: 'Statement/billing document, not a transaction',
        shouldProcess: false
      };
    }

    // Check for promotional content
    if (this.isPromotional(email)) {
      return {
        isTransaction: false,
        category: 'promotional',
        confidence: 0.85,
        reason: 'Promotional/marketing email',
        shouldProcess: false
      };
    }

    // Check for account alerts (not transactions)
    if (this.isAccountAlert(email)) {
      return {
        isTransaction: false,
        category: 'alert',
        confidence: 0.80,
        reason: 'Account alert, not a transaction',
        shouldProcess: false
      };
    }

    // Now check for ACTUAL transaction emails
    const transactionMatch = this.matchTransactionPattern(email);

    if (transactionMatch.type === 'debit') {
      if (!isBankSender && !transactionMatch.confidence) {
        // If not bank sender and confidence low, reject
        return {
          isTransaction: false,
          category: 'unknown',
          confidence: 0,
          reason: 'Non-bank sender and weak pattern',
          shouldProcess: false
        };
      }
      return {
        isTransaction: true,
        category: 'transaction_debit',
        confidence: transactionMatch.confidence,
        reason: 'Purchase transaction detected',
        shouldProcess: true  // PROCESS THIS
      };
    }

    if (transactionMatch.type === 'refund') {
      return {
        isTransaction: true,
        category: 'transaction_refund',
        confidence: transactionMatch.confidence,
        reason: 'Refund transaction detected',
        shouldProcess: true  // PROCESS THIS
      };
    }

    if (transactionMatch.type === 'credit') {
      return {
        isTransaction: true,
        category: 'transaction_credit',
        confidence: transactionMatch.confidence,
        reason: 'Credit transaction detected',
        shouldProcess: true  // Process credits too (rewards/cashback)
      };
    }

    return {
      isTransaction: false,
      category: 'unknown',
      confidence: 0,
      reason: 'No transaction pattern matched',
      shouldProcess: false
    };
  }

  private static normalizeEmail(msg: SimplifiedEmail | gmail_v1.Schema$Message): SimplifiedEmail {
    if ('messageId' in msg) return msg as SimplifiedEmail;

    // Convert gmail_v1.Schema$Message to SimplifiedEmail structure
    const headers = msg.payload?.headers || [];
    const from = headers.find(h => h.name === 'From')?.value || '';
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    return {
      messageId: msg.id || '',
      threadId: msg.threadId || '',
      from,
      subject,
      body: msg.snippet || '', // Use snippet for detection if body not fully available here
      internalDate: parseInt(msg.internalDate || '0'),
      to: ''
    };
  }

  /**
   * Detect OTP/2FA emails
   */
  private static isOtpEmail(email: SimplifiedEmail): boolean {
    const combined = (email.subject + ' ' + email.body).toUpperCase();
    const otpPatterns = [
      /\b(OTP|ONE[\s-]?TIME[\s-]?PASSWORD)\b/,
      /\b(VERIFICATION|VERIFY)\s+CODE\b/,
      /\b(CONFIRMATION|CONFIRM)\s+CODE\b/,
      /\b\d{4,6}\b.*?(valid|expires?|use)/i,
      /enter.*?\d{4,6}.*?to.*?(verify|confirm)/i,
      /don'?t share.*?(code|otp)/i
    ];

    return otpPatterns.some(pattern => pattern.test(combined));
  }

  /**
   * Detect payment success (bill payment, NOT a purchase)
   */
  private static isPaymentSuccess(email: SimplifiedEmail): boolean {
    const combined = (email.subject + ' ' + email.body).toUpperCase();
    const paymentPatterns = [
      /\b(PAYMENT|BILL)\s+(RECEIVED|SUCCESS|CONFIRMED)\b/,
      /\b(PAYMENT|BILL)\s+OF\s+₹/,
      /\byour.*?payment\s+(has been|was|is)\s+(received|processed|confirmed)/i,
      /\btotal amount received\b/,
      /\bdue amount paid\b/,
      /\bthank you for (paying|clearing)/i
    ];

    return paymentPatterns.some(pattern => pattern.test(combined));
  }

  /**
   * Detect statement/billing document
   */
  private static isStatementPdf(email: SimplifiedEmail): boolean {
    const combined = (email.subject + ' ' + email.body).toUpperCase();
    const statementPatterns = [
      /\b(STATEMENT|BILL|INVOICE)\b/i,
      /attached.*?(statement|pdf|bill)/i,
      /\byour.*?statement.*?is ready/i,
      /\bstatement for.*?(january|february|march|april|may|june|july|august|september|october|november|december)/i
    ];

    // High confidence if "Statement" or "PDF" in subject
    if (/\b(STATEMENT|BILL STATEMENT)\b/i.test(email.subject)) return true;

    return statementPatterns.some(pattern => pattern.test(combined));
  }

  /**
   * Detect promotional emails
   */
  private static isPromotional(email: SimplifiedEmail): boolean {
    const combined = (email.subject + ' ' + email.body).toUpperCase();
    const promoPatterns = [
      /\b(OFFER|PROMOTION|PROMO|DISCOUNT|CASHBACK|REWARDS?)\b/i,
      /\blimit.*?time.*?(offer|deal)/i,
      /\bexclusive.*?offer/i,
      /\bapply now|register|sign up/i,
      /\bterm.*?condition/i,
      /\bpersonal loan\b/i,
      /\bapply for\b/i
    ];

    // Check if email is pure promotion with no transaction
    // If it mentions spent/charged/transaction, it might be a promo ABOUT a transaction (e.g. cashback on transaction), 
    // but usually actual transaction alerts don't look like promos.
    // However, to be safe, if it looks like a transaction (price, merchant), we prioritize transaction logic unless promo signal is overwhelming.
    // For now, simple logic:
    const hasTransaction = /(?:charged|debited|spent|transaction|purchase)/i.test(combined) && /₹|INR|Rs/.test(combined);
    const isPromo = promoPatterns.some(pattern => pattern.test(combined));

    return isPromo && !hasTransaction;
  }

  /**
   * Detect account alerts (limits, security, etc.)
   */
  private static isAccountAlert(email: SimplifiedEmail): boolean {
    const combined = (email.subject + ' ' + email.body).toUpperCase();
    const alertPatterns = [
      /\blimit.*?(reached|exceeded|approaching|enhanced|increased)/i,
      /\b(security|fraud|suspicious)\b/i,
      /\b(unusual|abnormal)\s+activity\b/i,
      /\bcard.*?(activated|locked|blocked|disabled|closed)/i,
      /\baccount.*?(activated|changed|updated|kyc)/i,
      /\bpassword\b/i,
      /\balert:.*(login|sign in)/i
    ];

    return alertPatterns.some(pattern => pattern.test(combined));
  }

  /**
   * Match actual transaction patterns (debit, refund, credit)
   */
  private static matchTransactionPattern(email: SimplifiedEmail): {
    type: 'debit' | 'refund' | 'credit' | null;
    confidence: number;
  } {
    const combined = (email.subject + ' ' + email.body);
    const subject = email.subject.toUpperCase();

    // DEBIT TRANSACTION PATTERNS (money spent)
    const debitPatterns = [
      /\b(transaction|txn|purchase|spent|charged|swipe)\b/i,
      /\byour card.*?(charged|debited|spent)\s+₹/i,
      /\b(charged|debited)\s+(?:Rs|INR|₹)\s*[\d,]+/i,
      /\b(transaction|purchase).*?(?:Rs|INR|₹)\s*[\d,]+/i,
      /\bcard.*?spent.*?₹/i,
      /\bat\s+[A-Z0-9 ]+.*?(?:on|at)\s+\d{1,2}\/\d{1,2}/i  // "at MERCHANT on DATE"
    ];

    if (debitPatterns.some(pattern => pattern.test(combined))) {
      return { type: 'debit', confidence: 0.85 };
    }

    // REFUND PATTERNS (money credited back)
    const refundPatterns = [
      /\b(refund|reversal|cancellation)\b/i,
      /\brefund (of|amount)\s+₹/i,
      /\byour.*?refund\s+of\s+(?:Rs|INR|₹)\s*[\d,]+/i,
      /\bprevious transaction.*?refunded/i,
      /\breversed.*?(?:Rs|INR|₹)/i
    ];

    if (refundPatterns.some(pattern => pattern.test(combined))) {
      return { type: 'refund', confidence: 0.90 };
    }

    // CREDIT TRANSACTION PATTERNS (rewards, bonus, etc.)
    const creditPatterns = [
      /\b(credit|credited|added)\s+(?:Rs|INR|₹)\s*[\d,]+/i,
      /\brewards?.*?credited/i,
      /\bcashback.*?credited/i
    ];

    if (creditPatterns.some(pattern => pattern.test(combined))) {
      return { type: 'credit', confidence: 0.80 };
    }

    return { type: null, confidence: 0 };
  }
}
