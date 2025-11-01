import {
  BANK_EXTRACTION_PATTERNS,
  ExtractedTransaction,
  ExtractionPattern,
  parseAmount,
  parseDate,
  cleanMerchantName,
} from "./extraction-patterns";

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

export interface ExtractionResult {
  success: boolean;
  transaction: ExtractedTransaction | null;
  confidence: number;
  method: "regex" | "template" | "llm" | null;
  errors: string[];
}

/**
 * Transaction extractor using regex patterns
 */
export class TransactionExtractor {
  /**
   * Extract transaction from email
   */
  extract(emailData: EmailData, bankCode: string): ExtractionResult {
    const pattern = BANK_EXTRACTION_PATTERNS[bankCode];

    if (!pattern) {
      return {
        success: false,
        transaction: null,
        confidence: 0.0,
        method: null,
        errors: [`No extraction pattern found for bank: ${bankCode}`],
      };
    }

    try {
      const searchText = `${emailData.headers.subject} ${emailData.body.text} ${emailData.snippet}`;

      // Extract transaction components
      const amount = this.extractAmount(searchText, pattern);
      const merchant = this.extractMerchant(searchText, pattern);
      const date = this.extractDate(searchText, pattern);
      const cardLastFour = this.extractCardLastFour(searchText, pattern);
      const transactionType = this.extractTransactionType(searchText, pattern);

      // Calculate confidence based on extracted fields
      let confidence = 0.0;
      const errors: string[] = [];

      if (amount !== null) {
        confidence += 0.4;
      } else {
        errors.push("Amount not found");
      }

      if (merchant) {
        confidence += 0.3;
      } else {
        errors.push("Merchant not found");
      }

      if (date) {
        confidence += 0.2;
      } else {
        errors.push("Date not found");
      }

      if (cardLastFour) {
        confidence += 0.1;
      }

      // Must have at least amount to be successful
      if (amount === null) {
        return {
          success: false,
          transaction: null,
          confidence,
          method: "regex",
          errors,
        };
      }

      // Build transaction object
      const transaction: ExtractedTransaction = {
        amount,
        currency: "INR",
        merchant: merchant || "Unknown Merchant",
        date: date || new Date(emailData.headers.date),
        cardLastFour,
        transactionType: transactionType || "debit",
        category: this.categorizeMerchant(merchant || ""),
        confidence,
        extractionMethod: "regex",
        rawText: searchText.substring(0, 500),
      };

      return {
        success: true,
        transaction,
        confidence,
        method: "regex",
        errors: errors.length > 0 ? errors : [],
      };
    } catch (error) {
      return {
        success: false,
        transaction: null,
        confidence: 0.0,
        method: "regex",
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  /**
   * Extract amount from text
   */
  private extractAmount(text: string, pattern: ExtractionPattern): number | null {
    for (const regex of pattern.patterns.amount) {
      const matches = Array.from(text.matchAll(regex));
      if (matches.length > 0) {
        const amountStr = matches[0][1];
        try {
          const amount = parseAmount(amountStr);
          if (amount > 0 && amount < 10000000) {
            // Reasonable limit: 1 crore
            return amount;
          }
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  /**
   * Extract merchant from text
   */
  private extractMerchant(text: string, pattern: ExtractionPattern): string | null {
    for (const regex of pattern.patterns.merchant) {
      const matches = Array.from(text.matchAll(regex));
      if (matches.length > 0) {
        const merchant = matches[0][1];
        const cleaned = cleanMerchantName(merchant);
        if (cleaned.length >= 3 && cleaned.length <= 100) {
          return cleaned;
        }
      }
    }
    return null;
  }

  /**
   * Extract date from text
   */
  private extractDate(text: string, pattern: ExtractionPattern): Date | null {
    for (const regex of pattern.patterns.date) {
      const matches = Array.from(text.matchAll(regex));
      if (matches.length > 0) {
        const dateStr = matches[0][1];
        const date = parseDate(dateStr);
        if (date && !isNaN(date.getTime())) {
          return date;
        }
      }
    }
    return null;
  }

  /**
   * Extract card last four digits
   */
  private extractCardLastFour(text: string, pattern: ExtractionPattern): string | null {
    for (const regex of pattern.patterns.cardLastFour) {
      const matches = Array.from(text.matchAll(regex));
      if (matches.length > 0) {
        const lastFour = matches[0][1];
        if (/^\d{4}$/.test(lastFour)) {
          return lastFour;
        }
      }
    }
    return null;
  }

  /**
   * Extract transaction type
   */
  private extractTransactionType(
    text: string,
    pattern: ExtractionPattern
  ): "debit" | "credit" | null {
    const debitRegex = pattern.patterns.transactionType[0];
    const creditRegex = pattern.patterns.transactionType[1];

    if (debitRegex && debitRegex.test(text)) {
      return "debit";
    }

    if (creditRegex && creditRegex.test(text)) {
      return "credit";
    }

    return "debit"; // Default to debit for transactions
  }

  /**
   * Categorize merchant
   */
  private categorizeMerchant(merchant: string): string | null {
    const merchantLower = merchant.toLowerCase();

    // Food & Dining
    if (
      merchantLower.includes("swiggy") ||
      merchantLower.includes("zomato") ||
      merchantLower.includes("restaurant") ||
      merchantLower.includes("cafe") ||
      merchantLower.includes("food")
    ) {
      return "food_dining";
    }

    // Shopping
    if (
      merchantLower.includes("amazon") ||
      merchantLower.includes("flipkart") ||
      merchantLower.includes("myntra") ||
      merchantLower.includes("ajio") ||
      merchantLower.includes("mall") ||
      merchantLower.includes("store")
    ) {
      return "shopping";
    }

    // Transportation
    if (
      merchantLower.includes("uber") ||
      merchantLower.includes("ola") ||
      merchantLower.includes("rapido") ||
      merchantLower.includes("petrol") ||
      merchantLower.includes("fuel")
    ) {
      return "transportation";
    }

    // Entertainment
    if (
      merchantLower.includes("netflix") ||
      merchantLower.includes("prime") ||
      merchantLower.includes("hotstar") ||
      merchantLower.includes("cinema") ||
      merchantLower.includes("movie")
    ) {
      return "entertainment";
    }

    // Utilities
    if (
      merchantLower.includes("electricity") ||
      merchantLower.includes("water") ||
      merchantLower.includes("gas") ||
      merchantLower.includes("recharge")
    ) {
      return "utilities";
    }

    // Groceries
    if (
      merchantLower.includes("grocery") ||
      merchantLower.includes("supermarket") ||
      merchantLower.includes("blinkit") ||
      merchantLower.includes("bigbasket")
    ) {
      return "groceries";
    }

    return null;
  }

  /**
   * Batch extract transactions
   */
  batchExtract(emails: Array<{ email: EmailData; bankCode: string }>): ExtractionResult[] {
    return emails.map(({ email, bankCode }) => this.extract(email, bankCode));
  }
}

// Export singleton instance
export const transactionExtractor = new TransactionExtractor();
