import { createClient } from "@supabase/supabase-js";
import * as fs from "fs/promises";
import * as path from "path";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * OCR result from document processing
 */
export interface OCRResult {
  text: string;
  confidence: number;
  blocks: TextBlock[];
  tables: TableData[];
  metadata: {
    provider: "google_vision" | "aws_textract" | "azure_ocr";
    processingTime: number;
    pageCount: number;
    language?: string;
  };
}

/**
 * Text block from OCR
 */
export interface TextBlock {
  id: string;
  text: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  type: "paragraph" | "line" | "word" | "table_cell";
}

/**
 * Table data extracted from document
 */
export interface TableData {
  id: string;
  rows: TableRow[];
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Table row data
 */
export interface TableRow {
  cells: TableCell[];
}

/**
 * Table cell data
 */
export interface TableCell {
  text: string;
  confidence: number;
  columnSpan?: number;
  rowSpan?: number;
}

/**
 * Extracted transaction from OCR text
 */
export interface ExtractedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  merchant?: string;
  confidence: number;
  rawText: string;
  sourceBlock?: string;
}

/**
 * Transaction extraction options
 */
export interface ExtractionOptions {
  dateFormat?: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD" | "auto";
  amountPattern?: RegExp;
  descriptionFilters?: string[];
  minimumConfidence?: number;
}

/**
 * OCR Processing Service
 * Handles document OCR, text extraction, and transaction parsing
 */
export class OCRService {
  private static readonly SUPPORTED_FORMATS = [
    "pdf",
    "jpg",
    "jpeg",
    "png",
    "tiff",
  ];
  private static readonly DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

  /**
   * Perform OCR on uploaded document
   */
  static async performOCR(filePath: string): Promise<OCRResult> {
    try {
      const startTime = Date.now();

      // Validate file exists and format
      await this.validateFile(filePath);

      // Determine OCR provider based on environment
      const provider = this.selectOCRProvider();

      let result: OCRResult;

      switch (provider) {
        case "google_vision":
          result = await this.processWithGoogleVision(filePath);
          break;
        case "aws_textract":
          result = await this.processWithAWSTextract(filePath);
          break;
        case "azure_ocr":
          result = await this.processWithAzureOCR(filePath);
          break;
        default:
          throw new Error("No OCR provider available");
      }

      // Add processing metadata
      result.metadata.processingTime = Date.now() - startTime;
      result.metadata.provider = provider;

      return result;
    } catch (error) {
      console.error("OCR processing failed:", error);
      throw new Error(
        `OCR failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Extract transactions from OCR text
   */
  static async extractTransactions(
    ocrResult: OCRResult,
    options: ExtractionOptions = {}
  ): Promise<ExtractedTransaction[]> {
    try {
      const transactions: ExtractedTransaction[] = [];
      const {
        dateFormat = "auto",
        minimumConfidence = this.DEFAULT_CONFIDENCE_THRESHOLD,
      } = options;

      // Filter blocks with sufficient confidence
      const reliableBlocks = ocrResult.blocks.filter(
        (block) => block.confidence >= minimumConfidence
      );

      // Process tables first (usually more structured)
      for (const table of ocrResult.tables) {
        const tableTransactions = await this.extractFromTable(table, options);
        transactions.push(...tableTransactions);
      }

      // Process text blocks for any missed transactions
      const textTransactions = await this.extractFromText(
        reliableBlocks,
        options
      );
      transactions.push(...textTransactions);

      // Remove duplicates and sort by date
      const uniqueTransactions = this.removeDuplicateTransactions(transactions);

      return uniqueTransactions.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    } catch (error) {
      console.error("Transaction extraction failed:", error);
      throw new Error(
        `Extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Validate and auto-match extracted transactions
   */
  static async validateAndMatch(
    userId: string,
    extractedTransactions: ExtractedTransaction[]
  ): Promise<{
    validated: ExtractedTransaction[];
    matched: Array<{
      extracted: ExtractedTransaction;
      existing: any;
      confidence: number;
    }>;
    unmatched: ExtractedTransaction[];
    duplicates: ExtractedTransaction[];
  }> {
    try {
      // Get user's existing transactions for matching
      const { data: existingTransactions, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .gte("date", this.getDateRange(extractedTransactions).start)
        .lte("date", this.getDateRange(extractedTransactions).end);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const validated: ExtractedTransaction[] = [];
      const matched: Array<{
        extracted: ExtractedTransaction;
        existing: any;
        confidence: number;
      }> = [];
      const unmatched: ExtractedTransaction[] = [];
      const duplicates: ExtractedTransaction[] = [];

      for (const transaction of extractedTransactions) {
        // Validate transaction data
        if (!this.validateTransaction(transaction)) {
          continue; // Skip invalid transactions
        }

        validated.push(transaction);

        // Try to match with existing transactions
        const matchResult = this.findBestMatch(
          transaction,
          existingTransactions || []
        );

        if (matchResult && matchResult.confidence >= 0.8) {
          matched.push({
            extracted: transaction,
            existing: matchResult.transaction,
            confidence: matchResult.confidence,
          });
        } else {
          // Check for duplicates within extracted transactions
          const isDuplicate = validated
            .slice(0, -1)
            .some(
              (existing) =>
                this.calculateMatchConfidence(transaction, existing) >= 0.95
            );

          if (isDuplicate) {
            duplicates.push(transaction);
          } else {
            unmatched.push(transaction);
          }
        }
      }

      return {
        validated,
        matched,
        unmatched,
        duplicates,
      };
    } catch (error) {
      console.error("Validation and matching failed:", error);
      throw error;
    }
  }

  /**
   * Process document with Google Vision API
   */
  private static async processWithGoogleVision(
    filePath: string
  ): Promise<OCRResult> {
    // This is a mock implementation - in production, you would use the actual Google Vision API
    try {
      const fileExtension = path.extname(filePath).toLowerCase();
      const fileContent = await fs.readFile(filePath);

      // Mock OCR result based on file type and content
      const mockResult: OCRResult = {
        text: this.generateMockText(fileExtension),
        confidence: 0.85,
        blocks: this.generateMockBlocks(),
        tables: this.generateMockTables(),
        metadata: {
          provider: "google_vision",
          processingTime: 0, // Will be set by caller
          pageCount: 1,
          language: "en",
        },
      };

      return mockResult;
    } catch (error) {
      throw new Error(`Google Vision processing failed: ${error}`);
    }
  }

  /**
   * Process document with AWS Textract
   */
  private static async processWithAWSTextract(
    filePath: string
  ): Promise<OCRResult> {
    // Mock implementation - replace with actual AWS Textract integration
    throw new Error("AWS Textract integration not yet implemented");
  }

  /**
   * Process document with Azure OCR
   */
  private static async processWithAzureOCR(
    filePath: string
  ): Promise<OCRResult> {
    // Mock implementation - replace with actual Azure OCR integration
    throw new Error("Azure OCR integration not yet implemented");
  }

  /**
   * Extract transactions from table data
   */
  private static async extractFromTable(
    table: TableData,
    options: ExtractionOptions
  ): Promise<ExtractedTransaction[]> {
    const transactions: ExtractedTransaction[] = [];

    // Identify header row and column indices
    const headers =
      table.rows[0]?.cells.map((cell) => cell.text.toLowerCase()) || [];
    const dateIndex = headers.findIndex(
      (h) => h.includes("date") || h.includes("transaction")
    );
    const descIndex = headers.findIndex(
      (h) => h.includes("description") || h.includes("merchant")
    );
    const amountIndex = headers.findIndex(
      (h) => h.includes("amount") || h.includes("charge")
    );

    // Process data rows (skip header)
    for (let i = 1; i < table.rows.length; i++) {
      const row = table.rows[i];

      if (row.cells.length < 3) continue; // Skip incomplete rows

      try {
        const dateText = row.cells[dateIndex]?.text || "";
        const descText = row.cells[descIndex]?.text || "";
        const amountText = row.cells[amountIndex]?.text || "";

        const date = this.parseDate(dateText);
        const amount = this.parseAmount(amountText);

        if (date && amount !== null && descText.trim()) {
          transactions.push({
            id: `table_${table.id}_row_${i}`,
            date: date.toISOString().split("T")[0],
            description: descText.trim(),
            amount,
            confidence: Math.min(...row.cells.map((c) => c.confidence)),
            rawText: row.cells.map((c) => c.text).join(" | "),
            sourceBlock: `table_${table.id}`,
          });
        }
      } catch (error) {
        console.warn(`Failed to parse table row ${i}:`, error);
        continue;
      }
    }

    return transactions;
  }

  /**
   * Extract transactions from text blocks
   */
  private static async extractFromText(
    blocks: TextBlock[],
    options: ExtractionOptions
  ): Promise<ExtractedTransaction[]> {
    const transactions: ExtractedTransaction[] = [];

    // Combine blocks into lines
    const lines = blocks
      .filter((block) => block.type === "line" || block.type === "paragraph")
      .map((block) => block.text)
      .filter((line) => line.trim().length > 0);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for transaction patterns in the line
      const dateMatch = this.findDateInText(line);
      const amountMatch = this.findAmountInText(line);

      if (dateMatch && amountMatch) {
        try {
          const date = this.parseDate(dateMatch);
          const amount = this.parseAmount(amountMatch);

          if (date && amount !== null) {
            // Extract description (remove date and amount from line)
            let description = line
              .replace(dateMatch, "")
              .replace(amountMatch, "")
              .trim()
              .replace(/\s+/g, " ");

            transactions.push({
              id: `text_line_${i}`,
              date: date.toISOString().split("T")[0],
              description,
              amount,
              confidence: 0.8, // Default confidence for text extraction
              rawText: line,
              sourceBlock: `text_block_${i}`,
            });
          }
        } catch (error) {
          console.warn(`Failed to parse line ${i}: ${line}`, error);
          continue;
        }
      }
    }

    return transactions;
  }

  /**
   * Select appropriate OCR provider
   */
  private static selectOCRProvider():
    | "google_vision"
    | "aws_textract"
    | "azure_ocr" {
    // Check environment variables to determine available providers
    if (
      process.env.GOOGLE_CLOUD_PROJECT_ID &&
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    ) {
      return "google_vision";
    } else if (
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
    ) {
      return "aws_textract";
    } else if (
      process.env.AZURE_COMPUTER_VISION_KEY &&
      process.env.AZURE_COMPUTER_VISION_ENDPOINT
    ) {
      return "azure_ocr";
    } else {
      // Default to Google Vision for now
      return "google_vision";
    }
  }

  /**
   * Validate file for OCR processing
   */
  private static async validateFile(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);

      if (!stats.isFile()) {
        throw new Error("Path does not point to a file");
      }

      const extension = path.extname(filePath).toLowerCase().substring(1);
      if (!this.SUPPORTED_FORMATS.includes(extension)) {
        throw new Error(`Unsupported file format: ${extension}`);
      }
    } catch (error) {
      throw new Error(`File validation failed: ${error}`);
    }
  }

  /**
   * Generate mock OCR text for testing
   */
  private static generateMockText(fileType: string): string {
    return `
CREDIT CARD STATEMENT
Account Number: ****1234
Statement Period: 01/01/2024 - 01/31/2024

TRANSACTIONS:
01/03/2024  AMAZON PURCHASE          -$89.99
01/05/2024  GROCERY STORE            -$145.67
01/08/2024  GAS STATION              -$52.34
01/12/2024  RESTAURANT               -$78.45
01/15/2024  PAYMENT RECEIVED         +$500.00
01/18/2024  ONLINE SUBSCRIPTION      -$19.99
01/22/2024  DEPARTMENT STORE         -$234.56
01/25/2024  ATM WITHDRAWAL           -$100.00
01/28/2024  UTILITY PAYMENT          -$156.78

SUMMARY:
Previous Balance: $1,245.67
Payments: -$500.00
New Charges: $877.78
New Balance: $1,623.45
    `.trim();
  }

  /**
   * Generate mock text blocks for testing
   */
  private static generateMockBlocks(): TextBlock[] {
    return [
      {
        id: "block_1",
        text: "01/03/2024  AMAZON PURCHASE          -$89.99",
        confidence: 0.95,
        boundingBox: { x: 50, y: 100, width: 400, height: 20 },
        type: "line",
      },
      {
        id: "block_2",
        text: "01/05/2024  GROCERY STORE            -$145.67",
        confidence: 0.92,
        boundingBox: { x: 50, y: 125, width: 400, height: 20 },
        type: "line",
      },
      // Add more mock blocks...
    ];
  }

  /**
   * Generate mock table data for testing
   */
  private static generateMockTables(): TableData[] {
    return [
      {
        id: "table_1",
        confidence: 0.88,
        boundingBox: { x: 50, y: 200, width: 500, height: 200 },
        rows: [
          {
            cells: [
              { text: "Date", confidence: 0.95 },
              { text: "Description", confidence: 0.95 },
              { text: "Amount", confidence: 0.95 },
            ],
          },
          {
            cells: [
              { text: "01/03/2024", confidence: 0.92 },
              { text: "AMAZON PURCHASE", confidence: 0.88 },
              { text: "-$89.99", confidence: 0.91 },
            ],
          },
        ],
      },
    ];
  }

  /**
   * Parse date from text with various formats
   */
  private static parseDate(dateText: string): Date | null {
    const cleanText = dateText.trim().replace(/[^\d\/\-]/g, "");

    const patterns = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY or DD/MM/YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
      /(\d{1,2})-(\d{1,2})-(\d{4})/, // MM-DD-YYYY or DD-MM-YYYY
    ];

    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match) {
        try {
          const [, part1, part2, part3] = match;

          // Try different date interpretations
          const date1 = new Date(
            parseInt(part3),
            parseInt(part1) - 1,
            parseInt(part2)
          );
          const date2 = new Date(
            parseInt(part3),
            parseInt(part2) - 1,
            parseInt(part1)
          );
          const date3 = new Date(
            parseInt(part1),
            parseInt(part2) - 1,
            parseInt(part3)
          );

          // Return the most reasonable date
          const currentYear = new Date().getFullYear();
          if (date1.getFullYear() <= currentYear && date1.getMonth() < 12) {
            return date1;
          } else if (
            date2.getFullYear() <= currentYear &&
            date2.getMonth() < 12
          ) {
            return date2;
          } else if (
            date3.getFullYear() <= currentYear &&
            date3.getMonth() < 12
          ) {
            return date3;
          }
        } catch (error) {
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Parse amount from text
   */
  private static parseAmount(amountText: string): number | null {
    // Remove non-numeric characters except decimal point, comma, and minus sign
    const cleanText = amountText.replace(/[^\d\.,\-\+]/g, "");

    const patterns = [
      /^[\+\-]?\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)$/, // $1,234.56 or 1,234.56
      /^[\+\-]?(\d+(?:\.\d{2})?)$/, // 123.45
    ];

    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match) {
        try {
          let numStr = match[1].replace(/,/g, "");
          let amount = parseFloat(numStr);

          // Handle negative amounts
          if (
            amountText.includes("-") ||
            (amountText.includes("(") && amountText.includes(")"))
          ) {
            amount = -Math.abs(amount);
          }

          return amount;
        } catch (error) {
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Find date pattern in text
   */
  private static findDateInText(text: string): string | null {
    const datePatterns = [
      /\d{1,2}\/\d{1,2}\/\d{4}/,
      /\d{4}-\d{1,2}-\d{1,2}/,
      /\d{1,2}-\d{1,2}-\d{4}/,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  /**
   * Find amount pattern in text
   */
  private static findAmountInText(text: string): string | null {
    const amountPatterns = [
      /[\+\-]?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/,
      /\(\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)/,
    ];

    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  /**
   * Remove duplicate transactions
   */
  private static removeDuplicateTransactions(
    transactions: ExtractedTransaction[]
  ): ExtractedTransaction[] {
    const unique: ExtractedTransaction[] = [];

    for (const transaction of transactions) {
      const isDuplicate = unique.some(
        (existing) =>
          this.calculateMatchConfidence(transaction, existing) >= 0.95
      );

      if (!isDuplicate) {
        unique.push(transaction);
      }
    }

    return unique;
  }

  /**
   * Calculate match confidence between two transactions
   */
  private static calculateMatchConfidence(
    t1: ExtractedTransaction,
    t2: ExtractedTransaction
  ): number {
    let confidence = 0;

    // Date match (40% weight)
    if (t1.date === t2.date) {
      confidence += 0.4;
    } else {
      const date1 = new Date(t1.date);
      const date2 = new Date(t2.date);
      const daysDiff =
        Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff <= 1) {
        confidence += 0.2;
      }
    }

    // Amount match (40% weight)
    if (Math.abs(t1.amount - t2.amount) < 0.01) {
      confidence += 0.4;
    } else {
      const amountDiff = Math.abs(t1.amount - t2.amount);
      if (amountDiff <= Math.abs(t1.amount) * 0.05) {
        // 5% tolerance
        confidence += 0.2;
      }
    }

    // Description similarity (20% weight)
    const desc1 = t1.description.toLowerCase().replace(/[^\w\s]/g, "");
    const desc2 = t2.description.toLowerCase().replace(/[^\w\s]/g, "");
    const similarity = this.calculateStringSimilarity(desc1, desc2);
    confidence += similarity * 0.2;

    return confidence;
  }

  /**
   * Calculate string similarity (simplified Levenshtein distance)
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0 || len2 === 0) return 0;

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
   * Validate transaction data
   */
  private static validateTransaction(
    transaction: ExtractedTransaction
  ): boolean {
    // Check required fields
    if (
      !transaction.date ||
      !transaction.description ||
      transaction.amount === null ||
      transaction.amount === undefined
    ) {
      return false;
    }

    // Validate date
    const date = new Date(transaction.date);
    if (isNaN(date.getTime())) {
      return false;
    }

    // Check if date is reasonable (within last 10 years and not future)
    const now = new Date();
    const tenYearsAgo = new Date(now.getFullYear() - 10, 0, 1);
    if (date < tenYearsAgo || date > now) {
      return false;
    }

    // Validate amount (should be reasonable)
    if (Math.abs(transaction.amount) > 1000000) {
      // $1M limit
      return false;
    }

    // Check description length
    if (transaction.description.trim().length < 2) {
      return false;
    }

    return true;
  }

  /**
   * Find best match for transaction
   */
  private static findBestMatch(
    transaction: ExtractedTransaction,
    existingTransactions: any[]
  ): { transaction: any; confidence: number } | null {
    let bestMatch: { transaction: any; confidence: number } | null = null;

    for (const existing of existingTransactions) {
      const confidence = this.calculateMatchConfidence(transaction, {
        id: existing.id,
        date: existing.date,
        description: existing.description,
        amount: existing.amount,
        confidence: 1,
        rawText: existing.description,
      });

      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { transaction: existing, confidence };
      }
    }

    return bestMatch && bestMatch.confidence >= 0.6 ? bestMatch : null;
  }

  /**
   * Get date range from extracted transactions
   */
  private static getDateRange(transactions: ExtractedTransaction[]): {
    start: string;
    end: string;
  } {
    if (transactions.length === 0) {
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

    const dates = transactions.map((t) => t.date).sort();
    return {
      start: dates[0],
      end: dates[dates.length - 1],
    };
  }
}
