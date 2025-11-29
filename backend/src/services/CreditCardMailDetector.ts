import { gmail_v1 } from 'googleapis';

export interface DetectionResult {
  isTransaction: boolean;
  confidence: number;
  reason?: string;
  hasPdf?: boolean;
}

export class CreditCardMailDetector {
  // Configurable rules
  private static readonly SENDER_DOMAINS = [
    'hdfcbank.net', 'sbi.co.in', 'icicibank.com', 'axisbank.com', 
    'idfcfirstbank.com', 'indusind.com', 'citibank.com', 'amex.com',
    'hsbc.co.in', 'kotak.com', 'rblbank.com', 'sc.com'
  ];

  private static readonly SUBJECT_KEYWORDS = [
    /transaction alert/i,
    /credit card statement/i,
    /payment received/i,
    /spent/i,
    /purchase/i,
    /debited/i,
    /charged/i,
    /e-statement/i,
    /transaction notification/i
  ];

  private static readonly BODY_KEYWORDS = [
    /ending in \d{4}/i,
    /card no\.? \w*\d{4}/i,
    /available limit/i,
    /transaction of/i,
    /spent on/i,
    /merchant/i,
    /otp/i // Sometimes OTP emails contain txn details, but we might want to be careful
  ];

  /**
   * Detect if an email is a credit card transaction email
   */
  static detect(message: gmail_v1.Schema$Message): DetectionResult {
    const headers = message.payload?.headers || [];
    const fromHeader = headers.find(h => h.name === 'From')?.value || '';
    const subjectHeader = headers.find(h => h.name === 'Subject')?.value || '';
    
    // 1. Check Sender
    const isBankSender = this.SENDER_DOMAINS.some(domain => fromHeader.toLowerCase().includes(domain));
    
    // 2. Check Subject
    const hasTransactionSubject = this.SUBJECT_KEYWORDS.some(regex => regex.test(subjectHeader));

    // 3. Check Attachments (PDFs often are statements)
    const parts = message.payload?.parts || [];
    const hasPdf = parts.some(part => part.mimeType === 'application/pdf' || part.filename?.toLowerCase().endsWith('.pdf'));

    // 4. Check Body (Snippet)
    const snippet = message.snippet || '';
    const hasBodyKeywords = this.BODY_KEYWORDS.some(regex => regex.test(snippet));

    // Debug logging for first few emails
    const shouldLog = Math.random() < 0.01; // Log ~1% of emails
    if (shouldLog) {
      console.log('[CreditCardMailDetector] Sample detection:', {
        from: fromHeader.substring(0, 50),
        subject: subjectHeader.substring(0, 50),
        isBankSender,
        hasTransactionSubject,
        hasBodyKeywords,
        hasPdf
      });
    }

    // Decision Logic - MORE LENIENT
    // Option 1: Bank sender + any signal
    if (isBankSender && (hasTransactionSubject || hasBodyKeywords || hasPdf)) {
      return {
        isTransaction: true,
        confidence: 0.9,
        reason: 'Bank sender + keywords/PDF',
        hasPdf
      };
    }

    // Option 2: Strong subject alone (even without bank sender)
    if (hasTransactionSubject) {
      return {
        isTransaction: true,
        confidence: 0.7,
        reason: 'Transaction subject keywords',
        hasPdf
      };
    }

    // Option 3: Body keywords with PDF
    if (hasBodyKeywords && hasPdf) {
      return {
        isTransaction: true,
        confidence: 0.6,
        reason: 'Body keywords + PDF attachment',
        hasPdf
      };
    }

    return {
      isTransaction: false,
      confidence: 0.1,
      reason: 'No strong signals',
      hasPdf
    };
  }
}
