import { createClient } from "@supabase/supabase-js";
import { ExtractedTransaction } from "./ocr.service";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Transaction match result
 */
export interface TransactionMatch {
  extractedTransaction: ExtractedTransaction;
  existingTransaction: any;
  matchType: "exact" | "probable" | "possible" | "no_match";
  confidence: number;
  matchCriteria: {
    dateMatch: boolean;
    amountMatch: boolean;
    descriptionSimilarity: number;
    merchantMatch: boolean;
  };
  discrepancies: string[];
}

/**
 * Reconciliation summary
 */
export interface ReconciliationSummary {
  totalExtracted: number;
  exactMatches: number;
  probableMatches: number;
  possibleMatches: number;
  noMatches: number;
  duplicatesFound: number;
  discrepanciesFound: number;
  confidenceScore: number;
  recommendations: ReconciliationRecommendation[];
}

/**
 * Reconciliation recommendation
 */
export interface ReconciliationRecommendation {
  type:
    | "import_new"
    | "review_discrepancy"
    | "merge_duplicate"
    | "manual_review";
  priority: "high" | "medium" | "low";
  description: string;
  affectedTransactions: string[];
  action?: {
    endpoint: string;
    method: string;
    payload?: any;
  };
}

/**
 * Discrepancy details
 */
export interface TransactionDiscrepancy {
  id: string;
  type:
    | "amount_mismatch"
    | "date_mismatch"
    | "description_mismatch"
    | "missing_transaction"
    | "duplicate_transaction";
  severity: "high" | "medium" | "low";
  extractedTransaction?: ExtractedTransaction;
  existingTransaction?: any;
  details: {
    field: string;
    extractedValue: any;
    existingValue: any;
    difference?: number;
  }[];
  suggestedResolution: string;
}

/**
 * Reconciliation options
 */
export interface ReconciliationOptions {
  dateToleranceDays?: number;
  amountTolerancePercent?: number;
  minimumDescriptionSimilarity?: number;
  autoImportThreshold?: number;
  includePendingTransactions?: boolean;
  dateRangeBuffer?: number; // Days to extend search range
}

/**
 * Transaction Reconciliation Service
 * Handles matching extracted transactions with existing records and identifying discrepancies
 */
export class TransactionReconciliationService {
  private static readonly DEFAULT_DATE_TOLERANCE = 2; // days
  private static readonly DEFAULT_AMOUNT_TOLERANCE = 0.01; // 1%
  private static readonly DEFAULT_DESCRIPTION_SIMILARITY = 0.7;
  private static readonly DEFAULT_AUTO_IMPORT_THRESHOLD = 0.9;

  /**
   * Reconcile extracted transactions with existing user transactions
   */
  static async reconcileTransactions(
    userId: string,
    extractedTransactions: ExtractedTransaction[],
    options: ReconciliationOptions = {}
  ): Promise<{
    matches: TransactionMatch[];
    summary: ReconciliationSummary;
    discrepancies: TransactionDiscrepancy[];
  }> {
    try {
      const {
        dateToleranceDays = this.DEFAULT_DATE_TOLERANCE,
        amountTolerancePercent = this.DEFAULT_AMOUNT_TOLERANCE,
        minimumDescriptionSimilarity = this.DEFAULT_DESCRIPTION_SIMILARITY,
        autoImportThreshold = this.DEFAULT_AUTO_IMPORT_THRESHOLD,
        includePendingTransactions = true,
        dateRangeBuffer = 7,
      } = options;

      // Get existing transactions for comparison
      const dateRange = this.calculateDateRange(
        extractedTransactions,
        dateRangeBuffer
      );
      const existingTransactions = await this.getExistingTransactions(
        userId,
        dateRange.start,
        dateRange.end,
        includePendingTransactions
      );

      // Perform matching
      const matches: TransactionMatch[] = [];
      const discrepancies: TransactionDiscrepancy[] = [];

      for (const extracted of extractedTransactions) {
        const matchResult = await this.findBestMatch(
          extracted,
          existingTransactions,
          {
            dateToleranceDays,
            amountTolerancePercent,
            minimumDescriptionSimilarity,
          }
        );

        matches.push(matchResult);

        // Identify discrepancies
        if (
          matchResult.matchType !== "no_match" &&
          matchResult.discrepancies.length > 0
        ) {
          const discrepancy = this.createDiscrepancy(
            extracted,
            matchResult.existingTransaction,
            matchResult.discrepancies
          );
          if (discrepancy) {
            discrepancies.push(discrepancy);
          }
        }
      }

      // Find duplicates within extracted transactions
      const duplicates = this.findDuplicateTransactions(extractedTransactions);
      for (const duplicate of duplicates) {
        discrepancies.push(duplicate);
      }

      // Generate summary
      const summary = this.generateReconciliationSummary(
        matches,
        discrepancies,
        autoImportThreshold
      );

      return {
        matches,
        summary,
        discrepancies,
      };
    } catch (error) {
      console.error("Error during reconciliation:", error);
      throw new Error(
        `Reconciliation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get existing transactions for a user within date range
   */
  private static async getExistingTransactions(
    userId: string,
    startDate: string,
    endDate: string,
    includePending: boolean = true
  ): Promise<any[]> {
    try {
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .gte("date", startDate)
        .lte("date", endDate);

      if (!includePending) {
        query = query.neq("status", "pending");
      }

      const { data: transactions, error } = await query;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return transactions || [];
    } catch (error) {
      console.error("Error fetching existing transactions:", error);
      throw error;
    }
  }

  /**
   * Find best match for an extracted transaction
   */
  private static async findBestMatch(
    extracted: ExtractedTransaction,
    existingTransactions: any[],
    options: {
      dateToleranceDays: number;
      amountTolerancePercent: number;
      minimumDescriptionSimilarity: number;
    }
  ): Promise<TransactionMatch> {
    let bestMatch: TransactionMatch = {
      extractedTransaction: extracted,
      existingTransaction: null,
      matchType: "no_match",
      confidence: 0,
      matchCriteria: {
        dateMatch: false,
        amountMatch: false,
        descriptionSimilarity: 0,
        merchantMatch: false,
      },
      discrepancies: [],
    };

    for (const existing of existingTransactions) {
      const matchResult = this.calculateMatch(extracted, existing, options);

      if (matchResult.confidence > bestMatch.confidence) {
        bestMatch = matchResult;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate match between extracted and existing transaction
   */
  private static calculateMatch(
    extracted: ExtractedTransaction,
    existing: any,
    options: {
      dateToleranceDays: number;
      amountTolerancePercent: number;
      minimumDescriptionSimilarity: number;
    }
  ): TransactionMatch {
    const criteria = {
      dateMatch: false,
      amountMatch: false,
      descriptionSimilarity: 0,
      merchantMatch: false,
    };

    const discrepancies: string[] = [];
    let confidence = 0;

    // Date matching
    const extractedDate = new Date(extracted.date);
    const existingDate = new Date(existing.date);
    const daysDiff =
      Math.abs(extractedDate.getTime() - existingDate.getTime()) /
      (1000 * 60 * 60 * 24);

    if (daysDiff <= options.dateToleranceDays) {
      criteria.dateMatch = true;
      confidence += 30; // 30% weight for date match
    } else if (daysDiff <= options.dateToleranceDays * 2) {
      confidence += 15; // Partial credit for near matches
      discrepancies.push(`Date difference: ${Math.round(daysDiff)} days`);
    }

    // Amount matching
    const amountDiff = Math.abs(
      Math.abs(extracted.amount) - Math.abs(existing.amount)
    );
    const amountTolerance =
      Math.abs(existing.amount) * options.amountTolerancePercent;

    if (amountDiff <= amountTolerance) {
      criteria.amountMatch = true;
      confidence += 40; // 40% weight for amount match
    } else {
      const percentDiff = (amountDiff / Math.abs(existing.amount)) * 100;
      if (percentDiff <= 5) {
        confidence += 20; // Partial credit for small differences
      }
      discrepancies.push(
        `Amount difference: $${amountDiff.toFixed(2)} (${percentDiff.toFixed(1)}%)`
      );
    }

    // Description similarity
    const descSimilarity = this.calculateStringSimilarity(
      extracted.description.toLowerCase(),
      existing.description.toLowerCase()
    );
    criteria.descriptionSimilarity = descSimilarity;

    if (descSimilarity >= options.minimumDescriptionSimilarity) {
      confidence += Math.round(descSimilarity * 20); // Up to 20% weight for description
    } else if (descSimilarity >= 0.5) {
      confidence += Math.round(descSimilarity * 10); // Partial credit
      discrepancies.push(
        `Low description similarity: ${Math.round(descSimilarity * 100)}%`
      );
    }

    // Merchant matching (if available)
    if (extracted.merchant && existing.merchant) {
      const merchantSimilarity = this.calculateStringSimilarity(
        extracted.merchant.toLowerCase(),
        existing.merchant.toLowerCase()
      );

      if (merchantSimilarity >= 0.8) {
        criteria.merchantMatch = true;
        confidence += 10; // 10% weight for merchant match
      }
    }

    // Determine match type
    let matchType: "exact" | "probable" | "possible" | "no_match" = "no_match";

    if (confidence >= 90) {
      matchType = "exact";
    } else if (confidence >= 70) {
      matchType = "probable";
    } else if (confidence >= 50) {
      matchType = "possible";
    }

    return {
      extractedTransaction: extracted,
      existingTransaction: existing,
      matchType,
      confidence,
      matchCriteria: criteria,
      discrepancies,
    };
  }

  /**
   * Calculate string similarity using simplified Levenshtein distance
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;

    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0 || len2 === 0) return 0;

    // Use a more efficient approach for large strings
    if (len1 > 100 || len2 > 100) {
      // Use substring matching for long strings
      const shorter = len1 < len2 ? str1 : str2;
      const longer = len1 >= len2 ? str1 : str2;

      if (longer.includes(shorter)) {
        return shorter.length / longer.length;
      }

      // Check for common words
      const words1 = str1.split(/\s+/);
      const words2 = str2.split(/\s+/);
      const commonWords = words1.filter((word) => words2.includes(word));

      return (commonWords.length * 2) / (words1.length + words2.length);
    }

    // Full Levenshtein distance for shorter strings
    const matrix = Array(len2 + 1)
      .fill(null)
      .map(() => Array(len1 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1, // deletion
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return 1 - matrix[len2][len1] / maxLen;
  }

  /**
   * Calculate date range for fetching existing transactions
   */
  private static calculateDateRange(
    extractedTransactions: ExtractedTransaction[],
    bufferDays: number = 7
  ): { start: string; end: string } {
    if (extractedTransactions.length === 0) {
      const now = new Date();
      const monthAgo = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        now.getDate()
      );
      return {
        start: monthAgo.toISOString().split("T")[0],
        end: now.toISOString().split("T")[0],
      };
    }

    const dates = extractedTransactions.map((t) => new Date(t.date));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Add buffer
    minDate.setDate(minDate.getDate() - bufferDays);
    maxDate.setDate(maxDate.getDate() + bufferDays);

    return {
      start: minDate.toISOString().split("T")[0],
      end: maxDate.toISOString().split("T")[0],
    };
  }

  /**
   * Find duplicate transactions within extracted data
   */
  private static findDuplicateTransactions(
    extractedTransactions: ExtractedTransaction[]
  ): TransactionDiscrepancy[] {
    const discrepancies: TransactionDiscrepancy[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < extractedTransactions.length; i++) {
      if (processed.has(extractedTransactions[i].id)) continue;

      const duplicates = [];
      for (let j = i + 1; j < extractedTransactions.length; j++) {
        const similarity = this.calculateTransactionSimilarity(
          extractedTransactions[i],
          extractedTransactions[j]
        );

        if (similarity >= 0.95) {
          duplicates.push(extractedTransactions[j]);
          processed.add(extractedTransactions[j].id);
        }
      }

      if (duplicates.length > 0) {
        discrepancies.push({
          id: `duplicate_${extractedTransactions[i].id}`,
          type: "duplicate_transaction",
          severity: "medium",
          extractedTransaction: extractedTransactions[i],
          details: [
            {
              field: "duplicate_count",
              extractedValue: duplicates.length + 1,
              existingValue: 1,
              difference: duplicates.length,
            },
          ],
          suggestedResolution: `Remove ${duplicates.length} duplicate transaction(s)`,
        });

        processed.add(extractedTransactions[i].id);
      }
    }

    return discrepancies;
  }

  /**
   * Calculate similarity between two extracted transactions
   */
  private static calculateTransactionSimilarity(
    t1: ExtractedTransaction,
    t2: ExtractedTransaction
  ): number {
    let similarity = 0;

    // Date match (40% weight)
    if (t1.date === t2.date) {
      similarity += 0.4;
    }

    // Amount match (40% weight)
    if (Math.abs(t1.amount - t2.amount) < 0.01) {
      similarity += 0.4;
    }

    // Description similarity (20% weight)
    const descSimilarity = this.calculateStringSimilarity(
      t1.description,
      t2.description
    );
    similarity += descSimilarity * 0.2;

    return similarity;
  }

  /**
   * Create discrepancy record
   */
  private static createDiscrepancy(
    extracted: ExtractedTransaction,
    existing: any,
    discrepancyMessages: string[]
  ): TransactionDiscrepancy | null {
    if (discrepancyMessages.length === 0) return null;

    const details: Array<{
      field: string;
      extractedValue: any;
      existingValue: any;
      difference?: number;
    }> = [];

    // Parse discrepancy messages to create structured details
    for (const message of discrepancyMessages) {
      if (message.includes("Date difference")) {
        const days = parseInt(message.match(/\d+/)?.[0] || "0");
        details.push({
          field: "date",
          extractedValue: extracted.date,
          existingValue: existing.date,
          difference: days,
        });
      } else if (message.includes("Amount difference")) {
        const amount = parseFloat(message.match(/\$(\d+\.?\d*)/)?.[1] || "0");
        details.push({
          field: "amount",
          extractedValue: extracted.amount,
          existingValue: existing.amount,
          difference: amount,
        });
      } else if (message.includes("description similarity")) {
        const similarity = parseInt(message.match(/(\d+)%/)?.[1] || "0");
        details.push({
          field: "description",
          extractedValue: extracted.description,
          existingValue: existing.description,
          difference: similarity,
        });
      }
    }

    // Determine severity based on discrepancy types
    let severity: "high" | "medium" | "low" = "low";
    if (details.some((d) => d.field === "amount" && (d.difference || 0) > 10)) {
      severity = "high";
    } else if (details.length > 1) {
      severity = "medium";
    }

    return {
      id: `discrepancy_${extracted.id}_${existing.id}`,
      type: "amount_mismatch", // Default type, could be more specific
      severity,
      extractedTransaction: extracted,
      existingTransaction: existing,
      details,
      suggestedResolution: "Manual review required to resolve discrepancies",
    };
  }

  /**
   * Generate reconciliation summary
   */
  private static generateReconciliationSummary(
    matches: TransactionMatch[],
    discrepancies: TransactionDiscrepancy[],
    autoImportThreshold: number
  ): ReconciliationSummary {
    const exactMatches = matches.filter((m) => m.matchType === "exact").length;
    const probableMatches = matches.filter(
      (m) => m.matchType === "probable"
    ).length;
    const possibleMatches = matches.filter(
      (m) => m.matchType === "possible"
    ).length;
    const noMatches = matches.filter((m) => m.matchType === "no_match").length;
    const duplicatesFound = discrepancies.filter(
      (d) => d.type === "duplicate_transaction"
    ).length;

    const totalMatches = exactMatches + probableMatches + possibleMatches;
    const confidenceScore =
      matches.length > 0
        ? matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length
        : 0;

    const recommendations: ReconciliationRecommendation[] = [];

    // Auto-import recommendations
    const autoImportCandidates = matches.filter(
      (m) => m.confidence >= autoImportThreshold * 100
    ).length;
    if (autoImportCandidates > 0) {
      recommendations.push({
        type: "import_new",
        priority: "high",
        description: `${autoImportCandidates} transaction(s) ready for automatic import`,
        affectedTransactions: matches
          .filter((m) => m.confidence >= autoImportThreshold * 100)
          .map((m) => m.extractedTransaction.id),
      });
    }

    // Review discrepancies
    const highPriorityDiscrepancies = discrepancies.filter(
      (d) => d.severity === "high"
    ).length;
    if (highPriorityDiscrepancies > 0) {
      recommendations.push({
        type: "review_discrepancy",
        priority: "high",
        description: `${highPriorityDiscrepancies} high-priority discrepancy(ies) require review`,
        affectedTransactions: discrepancies
          .filter((d) => d.severity === "high")
          .map((d) => d.id),
      });
    }

    // Duplicate handling
    if (duplicatesFound > 0) {
      recommendations.push({
        type: "merge_duplicate",
        priority: "medium",
        description: `${duplicatesFound} duplicate transaction(s) found`,
        affectedTransactions: discrepancies
          .filter((d) => d.type === "duplicate_transaction")
          .map((d) => d.id),
      });
    }

    // Manual review for possible matches
    if (possibleMatches > 0) {
      recommendations.push({
        type: "manual_review",
        priority: "low",
        description: `${possibleMatches} transaction(s) need manual review for matching`,
        affectedTransactions: matches
          .filter((m) => m.matchType === "possible")
          .map((m) => m.extractedTransaction.id),
      });
    }

    return {
      totalExtracted: matches.length,
      exactMatches,
      probableMatches,
      possibleMatches,
      noMatches,
      duplicatesFound,
      discrepanciesFound: discrepancies.length,
      confidenceScore: Math.round(confidenceScore),
      recommendations,
    };
  }

  /**
   * Apply reconciliation results automatically
   */
  static async applyReconciliation(
    userId: string,
    matches: TransactionMatch[],
    options: {
      autoImportThreshold?: number;
      mergeDuplicates?: boolean;
      updateExisting?: boolean;
    } = {}
  ): Promise<{
    imported: number;
    updated: number;
    skipped: number;
    errors: Array<{ transactionId: string; error: string }>;
  }> {
    const {
      autoImportThreshold = this.DEFAULT_AUTO_IMPORT_THRESHOLD,
      mergeDuplicates = false,
      updateExisting = false,
    } = options;

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ transactionId: string; error: string }> = [];

    for (const match of matches) {
      try {
        if (
          match.confidence >= autoImportThreshold * 100 &&
          match.matchType === "no_match"
        ) {
          // Import new transaction
          await this.importTransaction(userId, match.extractedTransaction);
          imported++;
        } else if (match.matchType === "exact" && updateExisting) {
          // Update existing transaction with extracted data
          await this.updateExistingTransaction(
            match.existingTransaction.id,
            match.extractedTransaction
          );
          updated++;
        } else {
          skipped++;
        }
      } catch (error) {
        errors.push({
          transactionId: match.extractedTransaction.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return { imported, updated, skipped, errors };
  }

  /**
   * Import extracted transaction as new transaction
   */
  private static async importTransaction(
    userId: string,
    extracted: ExtractedTransaction
  ): Promise<void> {
    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      date: extracted.date,
      description: extracted.description,
      amount: extracted.amount,
      category: extracted.category || "Uncategorized",
      merchant: extracted.merchant,
      confidence_score: extracted.confidence,
      source: "statement_upload",
      status: "completed",
    });

    if (error) {
      throw new Error(`Failed to import transaction: ${error.message}`);
    }
  }

  /**
   * Update existing transaction with extracted data
   */
  private static async updateExistingTransaction(
    transactionId: string,
    extracted: ExtractedTransaction
  ): Promise<void> {
    const { error } = await supabase
      .from("transactions")
      .update({
        description: extracted.description,
        merchant: extracted.merchant,
        confidence_score: extracted.confidence,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (error) {
      throw new Error(`Failed to update transaction: ${error.message}`);
    }
  }
}
