import {
  BankPattern,
  ExtractedTransaction,
  ALL_BANK_PATTERNS,
  GENERIC_PATTERNS,
} from "./bank-patterns";
import { NormalizedEmail } from "../email-fetcher";
import { logger } from "../utils/logger";
import crypto from "crypto";

/**
 * Extraction Result with Confidence
 */
export interface ExtractionResult {
  success: boolean;
  transaction?: ExtractedTransaction;
  confidence: number;
  method: string;
  reasons: string[];
}

/**
 * Transaction Extractor
 * Extracts transaction data from emails using bank-specific patterns
 */
export class TransactionExtractor {
  /**
   * Extract transaction from email
   * @param email - Normalized email
   * @param bankName - Optional bank name hint from classifier
   * @returns Extraction result with confidence
   */
  async extract(
    email: NormalizedEmail,
    bankName?: string
  ): Promise<ExtractionResult> {
    try {
      // Combine subject and plain body for extraction
      const text = `${email.subject}\n${email.bodyPlain}`;

      // Try bank-specific patterns first if bank known
      if (bankName) {
        const bankPattern = ALL_BANK_PATTERNS.find(
          (p) => p.bankName.toLowerCase() === bankName.toLowerCase()
        );
        if (bankPattern) {
          const result = this.tryPatterns(text, [bankPattern], email);
          if (result.success) {
            return result;
          }
        }
      }

      // Try all bank patterns
      const bankResult = this.tryPatterns(text, ALL_BANK_PATTERNS, email);
      if (bankResult.success) {
        return bankResult;
      }

      // Fallback to generic patterns
      const genericResult = this.tryPatterns(text, [GENERIC_PATTERNS], email);
      if (genericResult.success) {
        return genericResult;
      }

      // No patterns matched
      return {
        success: false,
        confidence: 0,
        method: "none",
        reasons: ["No matching patterns found"],
      };
    } catch (error) {
      logger.error("Extraction failed", {  error, emailId: email.id  });
      return {
        success: false,
        confidence: 0,
        method: "error",
        reasons: ["Extraction error"],
      };
    }
  }

  /**
   * Try patterns from banks
   */
  private tryPatterns(
    text: string,
    bankPatterns: BankPattern[],
    email: NormalizedEmail
  ): ExtractionResult {
    const reasons: string[] = [];

    // Sort patterns by priority
    const allPatterns = bankPatterns
      .flatMap((bp) =>
        bp.patterns.map((p) => ({ ...p, bankName: bp.bankName }))
      )
      .sort((a, b) => b.priority - a.priority);

    for (const pattern of allPatterns) {
      const match = text.match(pattern.regex);

      if (match) {
        // Extract fields based on mapping
        const extracted = this.extractFields(match, pattern.mapping, text);

        if (extracted.amount) {
          reasons.push(`Matched pattern: ${pattern.name}`);
          reasons.push(`Bank: ${pattern.bankName}`);

          // Calculate confidence
          const confidence = this.calculateConfidence(
            extracted,
            pattern.confidenceWeight
          );

          return {
            success: true,
            transaction: {
              ...extracted,
              rawText: text.substring(0, 500), // First 500 chars for reference
              patternName: pattern.name,
            } as ExtractedTransaction,
            confidence,
            method: pattern.bankName,
            reasons,
          };
        }
      }
    }

    return {
      success: false,
      confidence: 0,
      method: "none",
      reasons: ["No patterns matched"],
    };
  }

  /**
   * Extract fields from regex match
   */
  private extractFields(
    match: RegExpMatchArray,
    mapping: any,
    fullText: string
  ): Partial<ExtractedTransaction> {
    const extracted: Partial<ExtractedTransaction> = {};

    // Extract amount
    if (mapping.amount !== undefined) {
      const amountStr =
        typeof mapping.amount === "number"
          ? match[mapping.amount]
          : mapping.amount;
      const amount = this.parseAmount(amountStr);
      if (amount) {
        extracted.amount = amount;
      }
    }

    // Extract transaction type
    if (mapping.transactionType) {
      extracted.transactionType = mapping.transactionType;
    }

    // Extract merchant
    if (mapping.merchant !== undefined) {
      const merchantStr =
        typeof mapping.merchant === "number"
          ? match[mapping.merchant]
          : mapping.merchant;
      extracted.merchant = this.cleanMerchantName(merchantStr);
    }

    // Extract card last 4
    if (mapping.cardLast4 !== undefined) {
      const cardStr =
        typeof mapping.cardLast4 === "number"
          ? match[mapping.cardLast4]
          : mapping.cardLast4;
      extracted.cardLast4 = cardStr?.trim();
    }

    // Extract balance
    if (mapping.balance !== undefined) {
      const balanceStr =
        typeof mapping.balance === "number"
          ? match[mapping.balance]
          : mapping.balance;
      const balance = this.parseAmount(balanceStr);
      if (balance) {
        extracted.balance = balance;
      }
    }

    // Extract date (try to parse from email date if not in pattern)
    extracted.date = this.extractDate(fullText) || new Date();

    // Currency
    extracted.currency = mapping.currency || "INR";

    return extracted;
  }

  /**
   * Parse amount string to number
   */
  private parseAmount(amountStr: string | undefined): number | undefined {
    if (!amountStr) return undefined;

    // Remove commas and parse
    const cleaned = amountStr.replace(/,/g, "");
    const amount = parseFloat(cleaned);

    return isNaN(amount) ? undefined : amount;
  }

  /**
   * Clean merchant name
   */
  private cleanMerchantName(merchant: string | undefined): string | undefined {
    if (!merchant) return undefined;

    return merchant
      .trim()
      .replace(/\s+/g, " ") // Normalize spaces
      .replace(/[^\w\s\-\.]/g, "") // Remove special chars
      .substring(0, 100); // Limit length
  }

  /**
   * Extract date from text
   */
  private extractDate(text: string): Date | undefined {
    // Common date patterns
    const patterns = [
      /(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/,
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{2,4})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const date = new Date(match[0]);
          if (!isNaN(date.getTime())) {
            return date;
          }
        } catch (e) {
          // Continue to next pattern
        }
      }
    }

    return undefined;
  }

  /**
   * Calculate extraction confidence
   */
  private calculateConfidence(
    extracted: Partial<ExtractedTransaction>,
    baseWeight: number
  ): number {
    let confidence = baseWeight;

    // Bonus for having more fields
    if (extracted.merchant) confidence += 0.05;
    if (extracted.date) confidence += 0.03;
    if (extracted.cardLast4) confidence += 0.05;
    if (extracted.balance) confidence += 0.02;

    // Check amount plausibility
    if (extracted.amount) {
      if (extracted.amount > 0 && extracted.amount < 1000000) {
        confidence += 0.05;
      }
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate fingerprint for deduplication
   * @param transaction - Extracted transaction
   * @param emailMessageId - Email message ID
   * @returns SHA256 fingerprint
   */
  generateFingerprint(
    transaction: ExtractedTransaction,
    emailMessageId: string
  ): string {
    // Create deterministic string from key fields
    const parts = [
      emailMessageId,
      transaction.amount.toFixed(2),
      transaction.transactionType,
      transaction.merchant || "",
      transaction.cardLast4 || "",
    ];

    const data = parts.join("|");
    return crypto.createHash("sha256").update(data).digest("hex");
  }
}

// Export singleton
export const transactionExtractor = new TransactionExtractor();
