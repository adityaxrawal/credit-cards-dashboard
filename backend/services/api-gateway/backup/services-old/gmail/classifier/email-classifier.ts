import { NormalizedEmail } from "../email-fetcher";
import { logger } from "../utils/logger";
import { supabase } from "../../../../../../shared/database/supabase";

/**
 * Email classification types
 */
export type EmailClassification =
  | "transaction"
  | "notification"
  | "promotional"
  | "other";

/**
 * Classification result
 */
export interface ClassificationResult {
  classification: EmailClassification;
  confidence: number;
  reasons: string[];
  bankName?: string;
}

/**
 * Email Classifier
 * Uses rules-based heuristics to classify emails
 * Future: Can be enhanced with ML models
 */
export class EmailClassifier {
  // Known bank email domains
  private readonly BANK_DOMAINS = [
    "hdfcbank.net",
    "icicibank.com",
    "sbi.co.in",
    "axisbank.com",
    "kotak.com",
    "yesbank.in",
    "indusind.com",
    "pnbindia.in",
    "bankofbaroda.in",
    "canarabank.com",
    "idbibank.in",
    "unionbankofindia.co.in",
    "citibank.com",
    "sc.com", // Standard Chartered
    "hsbc.co.in",
    "americanexpress.com",
  ];

  // Transaction keywords in subject/body
  private readonly TRANSACTION_KEYWORDS = [
    "debited",
    "credited",
    "spent",
    "payment",
    "transaction",
    "purchase",
    "withdrawal",
    "deposit",
    "transfer",
    "refund",
    "cashback",
    "reward points",
    "emi",
    "bill payment",
    "statement",
    "balance",
    "account",
    "card ending",
    "card number",
    "merchant",
    "amount",
    "inr",
    "rs",
    "rupees",
  ];

  // Notification keywords
  private readonly NOTIFICATION_KEYWORDS = [
    "alert",
    "notification",
    "reminder",
    "due date",
    "bill generation",
    "statement generated",
    "card activation",
    "pin set",
    "limit increase",
    "kyc",
    "otp",
    "verification code",
  ];

  // Promotional keywords
  private readonly PROMOTIONAL_KEYWORDS = [
    "offer",
    "discount",
    "cashback offer",
    "special deal",
    "exclusive",
    "limited time",
    "hurry",
    "save",
    "rewards program",
    "upgrade",
    "new feature",
    "congratulations",
  ];

  /**
   * Classify an email
   * @param email - Normalized email object
   * @returns Classification result with confidence
   */
  async classify(email: NormalizedEmail): Promise<ClassificationResult> {
    try {
      // Check cache first
      const cached = await this.checkCache(email.from, email.subject);
      if (cached) {
        logger.debug(
          { emailId: email.id, classification: cached.classification },
          "Using cached classification"
        );
        return cached;
      }

      // Combine subject and body for analysis
      const text = `${email.subject} ${email.bodyPlain}`.toLowerCase();

      // Check if from a bank
      const bankName = this.detectBankFromEmail(email.from);
      const isFromBank = !!bankName;

      // Calculate scores for each classification
      const scores = {
        transaction: this.calculateTransactionScore(text, isFromBank),
        notification: this.calculateNotificationScore(text, isFromBank),
        promotional: this.calculatePromotionalScore(text, isFromBank),
        other: 0,
      };

      // Determine classification
      let classification: EmailClassification = "other";
      let maxScore = 0;
      let reasons: string[] = [];

      for (const [type, score] of Object.entries(scores)) {
        if (score > maxScore) {
          maxScore = score;
          classification = type as EmailClassification;
        }
      }

      // Build reasons
      if (classification === "transaction") {
        reasons = this.getTransactionReasons(text, isFromBank);
      } else if (classification === "notification") {
        reasons = this.getNotificationReasons(text, isFromBank);
      } else if (classification === "promotional") {
        reasons = this.getPromotionalReasons(text);
      }

      // Normalize confidence to 0-1
      const confidence = Math.min(maxScore / 100, 1);

      const result: ClassificationResult = {
        classification,
        confidence,
        reasons,
        bankName: bankName || undefined,
      };

      // Cache the result
      await this.cacheClassification(email.from, email.subject, result);

      logger.info(
        {
          emailId: email.id,
          classification,
          confidence,
          bankName,
        },
        "Email classified"
      );

      return result;
    } catch (error) {
      logger.error({ error, emailId: email.id }, "Classification failed");
      // Return default classification on error
      return {
        classification: "other",
        confidence: 0,
        reasons: ["Classification failed"],
      };
    }
  }

  /**
   * Detect bank from email address
   */
  private detectBankFromEmail(from: string): string | null {
    const emailLower = from.toLowerCase();

    for (const domain of this.BANK_DOMAINS) {
      if (emailLower.includes(domain)) {
        // Extract bank name from domain
        if (domain.includes("hdfcbank")) return "HDFC Bank";
        if (domain.includes("icicibank")) return "ICICI Bank";
        if (domain.includes("sbi")) return "State Bank of India";
        if (domain.includes("axisbank")) return "Axis Bank";
        if (domain.includes("kotak")) return "Kotak Mahindra Bank";
        if (domain.includes("yesbank")) return "Yes Bank";
        if (domain.includes("indusind")) return "IndusInd Bank";
        if (domain.includes("pnb")) return "Punjab National Bank";
        if (domain.includes("bankofbaroda")) return "Bank of Baroda";
        if (domain.includes("canarabank")) return "Canara Bank";
        if (domain.includes("idbi")) return "IDBI Bank";
        if (domain.includes("unionbank")) return "Union Bank of India";
        if (domain.includes("citibank")) return "Citibank";
        if (domain.includes("sc.com")) return "Standard Chartered";
        if (domain.includes("hsbc")) return "HSBC";
        if (domain.includes("americanexpress")) return "American Express";
        return domain;
      }
    }

    return null;
  }

  /**
   * Calculate transaction score
   */
  private calculateTransactionScore(text: string, isFromBank: boolean): number {
    let score = 0;

    // Bank emails are more likely to be transactions
    if (isFromBank) score += 30;

    // Check for transaction keywords
    const matches = this.TRANSACTION_KEYWORDS.filter((keyword) =>
      text.includes(keyword.toLowerCase())
    );
    score += matches.length * 10;

    // Check for amount patterns (INR, Rs, ₹)
    if (/(?:inr|rs\.?|₹)\s*[\d,]+(?:\.\d{2})?/i.test(text)) {
      score += 20;
    }

    // Check for card number pattern
    if (/\d{4}\s*\*+\s*\d{4}|\d{4}/.test(text)) {
      score += 15;
    }

    // Check for merchant name indicators
    if (/(?:at|merchant|from)\s+[A-Z][a-z]+/i.test(text)) {
      score += 10;
    }

    return score;
  }

  /**
   * Calculate notification score
   */
  private calculateNotificationScore(
    text: string,
    isFromBank: boolean
  ): number {
    let score = 0;

    if (isFromBank) score += 20;

    const matches = this.NOTIFICATION_KEYWORDS.filter((keyword) =>
      text.includes(keyword.toLowerCase())
    );
    score += matches.length * 15;

    return score;
  }

  /**
   * Calculate promotional score
   */
  private calculatePromotionalScore(text: string, isFromBank: boolean): number {
    let score = 0;

    const matches = this.PROMOTIONAL_KEYWORDS.filter((keyword) =>
      text.includes(keyword.toLowerCase())
    );
    score += matches.length * 12;

    // Promotional emails usually longer
    if (text.length > 1000) score += 10;

    // Bank promotionals are less common
    if (isFromBank) score -= 10;

    return score;
  }

  /**
   * Get transaction classification reasons
   */
  private getTransactionReasons(text: string, isFromBank: boolean): string[] {
    const reasons: string[] = [];

    if (isFromBank) reasons.push("From known bank domain");

    this.TRANSACTION_KEYWORDS.forEach((keyword) => {
      if (text.includes(keyword.toLowerCase())) {
        reasons.push(`Contains keyword: ${keyword}`);
      }
    });

    if (/(?:inr|rs\.?|₹)\s*[\d,]+(?:\.\d{2})?/i.test(text)) {
      reasons.push("Contains amount pattern");
    }

    if (/\d{4}\s*\*+\s*\d{4}|\d{4}/.test(text)) {
      reasons.push("Contains card number pattern");
    }

    return reasons.slice(0, 5); // Limit to top 5 reasons
  }

  /**
   * Get notification classification reasons
   */
  private getNotificationReasons(text: string, isFromBank: boolean): string[] {
    const reasons: string[] = [];

    if (isFromBank) reasons.push("From known bank domain");

    this.NOTIFICATION_KEYWORDS.forEach((keyword) => {
      if (text.includes(keyword.toLowerCase())) {
        reasons.push(`Contains keyword: ${keyword}`);
      }
    });

    return reasons.slice(0, 5);
  }

  /**
   * Get promotional classification reasons
   */
  private getPromotionalReasons(text: string): string[] {
    const reasons: string[] = [];

    this.PROMOTIONAL_KEYWORDS.forEach((keyword) => {
      if (text.includes(keyword.toLowerCase())) {
        reasons.push(`Contains keyword: ${keyword}`);
      }
    });

    if (text.length > 1000) {
      reasons.push("Long message (typical for promotions)");
    }

    return reasons.slice(0, 5);
  }

  /**
   * Check classification cache
   */
  private async checkCache(
    from: string,
    subject: string
  ): Promise<ClassificationResult | null> {
    try {
      // Normalize subject to pattern (remove specific numbers/dates)
      const subjectPattern = this.normalizeSubject(subject);

      const { data } = await supabase
        .from("email_classification_cache")
        .select("*")
        .eq("email_from", from)
        .eq("email_subject_pattern", subjectPattern)
        .single();

      if (data) {
        // Update hit count
        await supabase
          .from("email_classification_cache")
          .update({
            hit_count: data.hit_count + 1,
            last_hit: new Date().toISOString(),
          })
          .eq("id", data.id);

        return {
          classification: data.classification as EmailClassification,
          confidence: parseFloat(data.confidence),
          reasons: data.metadata?.reasons || [],
          bankName: data.metadata?.bankName,
        };
      }

      return null;
    } catch (error) {
      logger.debug({ error }, "Cache check failed");
      return null;
    }
  }

  /**
   * Cache classification result
   */
  private async cacheClassification(
    from: string,
    subject: string,
    result: ClassificationResult
  ): Promise<void> {
    try {
      const subjectPattern = this.normalizeSubject(subject);

      await supabase.from("email_classification_cache").upsert(
        {
          email_from: from,
          email_subject_pattern: subjectPattern,
          classification: result.classification,
          confidence: result.confidence,
          metadata: {
            reasons: result.reasons,
            bankName: result.bankName,
          },
        },
        {
          onConflict: "email_from,email_subject_pattern",
        }
      );
    } catch (error) {
      logger.debug({ error }, "Failed to cache classification");
    }
  }

  /**
   * Normalize subject to pattern by removing specific values
   */
  private normalizeSubject(subject: string): string {
    return subject
      .replace(/\d+/g, "N") // Replace numbers with N
      .replace(/[₹$£€]\s*[\d,]+\.?\d*/g, "AMT") // Replace amounts
      .replace(/\d{2}[/-]\d{2}[/-]\d{2,4}/g, "DATE") // Replace dates
      .toLowerCase()
      .slice(0, 500); // Limit length
  }
}

// Export singleton
export const emailClassifier = new EmailClassifier();
