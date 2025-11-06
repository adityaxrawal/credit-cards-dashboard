/**
 * Email classifier to identify transaction emails
 */

// Known bank sender patterns for Indian banks
const BANK_PATTERNS = {
  hdfc: {
    senders: [
      "alerts@hdfcbank.net",
      "hdfcbank@alerts.hdfcbank.net",
      "creditcards@hdfcbank.net",
      "swiggy@hdfcbank.net",
      "tataneu@hdfcbank.net",
    ],
    keywords: ["hdfc", "hdfcbank"],
  },
  sbi: {
    senders: ["sbicard@sbicard.com", "alerts@sbicard.com"],
    keywords: ["sbi", "sbicard", "state bank"],
  },
  icici: {
    senders: [
      "credit_cards@icicibank.com",
      "do-not-reply@icicibank.com",
      "alerts@icicibank.com",
    ],
    keywords: ["icici", "icicibank"],
  },
  axis: {
    senders: ["alerts@axisbank.com", "cards@axisbank.com"],
    keywords: ["axis", "axisbank", "airtel axis"],
  },
  idfc: {
    senders: ["alerts@idfcfirstbank.com", "creditcards@idfcfirstbank.com"],
    keywords: ["idfc", "idfcfirst", "millennial"],
  },
  indusind: {
    senders: ["alerts@indusind.com", "cards@indusind.com"],
    keywords: ["indusind", "legend"],
  },
  yes: {
    senders: ["alerts@yesbank.in", "creditcards@yesbank.in"],
    keywords: ["yes bank", "yesbank", "yes pop"],
  },
  jupiter: {
    senders: ["notifications@jupiter.money", "alerts@jupiter.money"],
    keywords: ["jupiter", "edge+"],
  },
  kotak: {
    senders: ["alerts@kotak.com", "creditcards@kotak.com"],
    keywords: ["kotak", "kotak mahindra"],
  },
  amex: {
    senders: ["no-reply@americanexpress.com", "alerts@americanexpress.com"],
    keywords: ["american express", "amex"],
  },
};

// Transaction keywords in subject/body
const TRANSACTION_KEYWORDS = [
  "transaction",
  "spent",
  "purchase",
  "payment",
  "debited",
  "charged",
  "Rs.",
  "INR",
  "₹",
  "amount",
  "merchant",
  "card ending",
  "card no",
  "UPI",
  "swiggy",
  "zomato",
  "amazon",
  "flipkart",
];

// Non-transaction keywords (to filter out)
const NON_TRANSACTION_KEYWORDS = [
  "otp",
  "one time password",
  "verification code",
  "statement",
  "bill generated",
  "payment due",
  "reminder",
  "welcome",
  "activated",
  "blocked",
  "unblocked",
  "reward points",
  "offer",
  "cashback credited",
];

export interface ClassificationResult {
  isTransaction: boolean;
  confidence: number;
  bankName: string | null;
  bankCode: string | null;
  category: string | null;
  reason: string;
}

export interface EmailData {
  id: string;
  headers: {
    from: string;
    to: string;
    subject: string;
    date: string;
  };
  body: {
    text: string;
    html: string | null;
  };
  snippet: string;
}

/**
 * Email classifier class
 */
export class EmailClassifier {
  /**
   * Classify email as transaction or non-transaction
   */
  classify(emailData: EmailData): ClassificationResult {
    const { headers, body, snippet } = emailData;
    const fromEmail = headers.from.toLowerCase();
    const subject = headers.subject.toLowerCase();
    const bodyText = (body.text || "").toLowerCase();
    const searchText = `${subject} ${bodyText} ${snippet}`.toLowerCase();

    // Step 1: Check if from a known bank
    const bankInfo = this.identifyBank(fromEmail, searchText);

    if (!bankInfo) {
      return {
        isTransaction: false,
        confidence: 0.0,
        bankName: null,
        bankCode: null,
        category: "unknown",
        reason: "Not from a recognized bank",
      };
    }

    // Step 2: Check for non-transaction keywords first
    const hasNonTransactionKeyword = NON_TRANSACTION_KEYWORDS.some((keyword) =>
      searchText.includes(keyword.toLowerCase())
    );

    if (hasNonTransactionKeyword) {
      return {
        isTransaction: false,
        confidence: 0.9,
        bankName: bankInfo.name,
        bankCode: bankInfo.code,
        category: this.identifyCategory(searchText),
        reason: "Contains non-transaction keywords (OTP, statement, etc.)",
      };
    }

    // Step 3: Check for transaction keywords
    const transactionKeywordMatches = TRANSACTION_KEYWORDS.filter((keyword) =>
      searchText.includes(keyword.toLowerCase())
    ).length;

    // Step 4: Check for amount patterns (Rs., INR, ₹)
    const hasAmountPattern =
      /(?:rs\.?|inr|₹)\s*[\d,]+(?:\.\d{2})?/i.test(searchText) ||
      /(?:amount|spent|debited|charged)[\s:]*[\d,]+(?:\.\d{2})?/i.test(searchText);

    // Step 5: Calculate confidence score
    let confidence = 0.0;

    // Bank match adds base confidence
    confidence += 0.3;

    // Transaction keywords add confidence (up to 0.4)
    confidence += Math.min(transactionKeywordMatches * 0.1, 0.4);

    // Amount pattern adds significant confidence
    if (hasAmountPattern) {
      confidence += 0.3;
    }

    // Classify as transaction if confidence > 0.5
    const isTransaction = confidence > 0.5;

    return {
      isTransaction,
      confidence: Math.min(confidence, 1.0),
      bankName: bankInfo.name,
      bankCode: bankInfo.code,
      category: this.identifyCategory(searchText),
      reason: isTransaction
        ? `Matched ${transactionKeywordMatches} transaction keywords, ${hasAmountPattern ? "has" : "no"} amount pattern`
        : "Low confidence transaction indicators",
    };
  }

  /**
   * Identify bank from sender email and content
   */
  private identifyBank(
    fromEmail: string,
    searchText: string
  ): { name: string; code: string } | null {
    for (const [code, bank] of Object.entries(BANK_PATTERNS)) {
      // Check sender email
      const senderMatch = bank.senders.some((sender) =>
        fromEmail.includes(sender.toLowerCase())
      );

      if (senderMatch) {
        return {
          name: this.getBankDisplayName(code),
          code,
        };
      }

      // Check keywords in content
      const keywordMatch = bank.keywords.some((keyword) =>
        searchText.includes(keyword.toLowerCase())
      );

      if (keywordMatch) {
        return {
          name: this.getBankDisplayName(code),
          code,
        };
      }
    }

    return null;
  }

  /**
   * Get display name for bank code
   */
  private getBankDisplayName(code: string): string {
    const names: Record<string, string> = {
      hdfc: "HDFC Bank",
      sbi: "SBI Card",
      icici: "ICICI Bank",
      axis: "Axis Bank",
      idfc: "IDFC First Bank",
      indusind: "IndusInd Bank",
      yes: "Yes Bank",
      jupiter: "Jupiter",
      kotak: "Kotak Mahindra Bank",
      amex: "American Express",
    };

    return names[code] || code.toUpperCase();
  }

  /**
   * Identify email category
   */
  private identifyCategory(searchText: string): string {
    if (searchText.includes("otp") || searchText.includes("one time password")) {
      return "otp";
    }

    if (searchText.includes("statement") || searchText.includes("bill generated")) {
      return "statement";
    }

    if (searchText.includes("payment due") || searchText.includes("reminder")) {
      return "reminder";
    }

    if (
      searchText.includes("transaction") ||
      searchText.includes("spent") ||
      searchText.includes("purchase")
    ) {
      return "transaction";
    }

    if (searchText.includes("reward") || searchText.includes("cashback")) {
      return "reward";
    }

    return "other";
  }

  /**
   * Batch classify multiple emails
   */
  batchClassify(emails: EmailData[]): ClassificationResult[] {
    return emails.map((email) => this.classify(email));
  }
}

// Export singleton instance
export const emailClassifier = new EmailClassifier();
