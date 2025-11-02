import { createClient } from "@supabase/supabase-js";
import * as fs from "fs/promises";
import * as path from "path";
import { createReadStream } from "fs";

// Simple UUID generator to avoid dependency issues
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Uploaded statement information
 */
export interface UploadedStatement {
  id: string;
  userId: string;
  cardId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  statementMonth: number;
  statementYear: number;
  processingStatus: "pending" | "processing" | "completed" | "failed";
  ocrProvider?: string;
  extractedData?: any;
  transactionsExtracted: number;
  transactionsMatched: number;
  errorMessage?: string;
  uploadedAt: string;
  processedAt?: string;
}

/**
 * Upload processing status
 */
export interface UploadStatus {
  uploadId: string;
  status: string;
  progress: {
    stage: "ocr" | "extraction" | "matching" | "completed";
    percentage: number;
  };
  results?: {
    transactionsFound: number;
    newTransactions: number;
    matchedTransactions: number;
    unmatchedTransactions: number;
    discrepancies: Array<{
      transactionId: string;
      statementAmount: number;
      extractedAmount: number;
      difference: number;
    }>;
  };
}

/**
 * Extracted transaction from statement
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
}

/**
 * File upload interface
 */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * File upload options
 */
export interface UploadOptions {
  cardId: string;
  statementMonth: number;
  statementYear: number;
  autoMatch?: boolean;
  userId: string;
}

/**
 * Statement Upload Service
 * Handles file uploads, storage, and processing coordination
 */
export class StatementUploadService {
  private static readonly UPLOAD_DIR = process.env.UPLOAD_DIR || "/tmp/uploads";
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
  ];

  /**
   * Initialize upload directory
   */
  static async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.UPLOAD_DIR, { recursive: true });
    } catch (error) {
      console.error("Failed to create upload directory:", error);
      throw new Error("Failed to initialize upload service");
    }
  }

  /**
   * Upload and process a statement file
   */
  static async uploadStatement(
    file: UploadedFile,
    options: UploadOptions
  ): Promise<{
    uploadId: string;
    status: string;
    estimatedProcessingTime: string;
  }> {
    try {
      // Validate file
      this.validateFile(file);

      // Validate options
      this.validateOptions(options);

      // Generate unique upload ID
      const uploadId = generateUUID();
      const fileName = `${uploadId}_${file.originalname}`;
      const filePath = path.join(this.UPLOAD_DIR, fileName);

      // Save file to disk
      await fs.writeFile(filePath, file.buffer);

      // Save upload record to database
      const { error } = await supabase.from("uploaded_statements").insert({
        id: uploadId,
        user_id: options.userId,
        card_id: options.cardId,
        file_name: file.originalname,
        file_path: filePath,
        file_size: file.size,
        file_type: file.mimetype,
        statement_month: options.statementMonth,
        statement_year: options.statementYear,
        processing_status: "pending",
        uploaded_at: new Date().toISOString(),
      });

      if (error) {
        // Clean up file on database error
        await fs.unlink(filePath).catch(() => {});
        throw new Error(`Database error: ${error.message}`);
      }

      // Start async processing
      this.processStatementAsync(uploadId, options.autoMatch || false);

      return {
        uploadId,
        status: "uploaded",
        estimatedProcessingTime: this.estimateProcessingTime(
          file.size,
          file.mimetype
        ),
      };
    } catch (error) {
      console.error("Error uploading statement:", error);
      throw error;
    }
  }

  /**
   * Get upload status and progress
   */
  static async getUploadStatus(
    uploadId: string,
    userId: string
  ): Promise<UploadStatus> {
    try {
      const { data: statement, error } = await supabase
        .from("uploaded_statements")
        .select("*")
        .eq("id", uploadId)
        .eq("user_id", userId)
        .single();

      if (error || !statement) {
        throw new Error("Upload not found");
      }

      const status: UploadStatus = {
        uploadId,
        status: statement.processing_status,
        progress: this.calculateProgress(statement),
      };

      // Add results if processing is completed
      if (
        statement.processing_status === "completed" &&
        statement.extracted_data
      ) {
        status.results = {
          transactionsFound: statement.transactions_extracted || 0,
          newTransactions: 0, // TODO: Calculate from matching results
          matchedTransactions: statement.transactions_matched || 0,
          unmatchedTransactions:
            (statement.transactions_extracted || 0) -
            (statement.transactions_matched || 0),
          discrepancies: statement.extracted_data.discrepancies || [],
        };
      }

      return status;
    } catch (error) {
      console.error("Error getting upload status:", error);
      throw error;
    }
  }

  /**
   * Get all uploaded statements for a user
   */
  static async getUserStatements(userId: string): Promise<UploadedStatement[]> {
    try {
      const { data: statements, error } = await supabase
        .from("uploaded_statements")
        .select(
          `
          *,
          credit_cards(name)
        `
        )
        .eq("user_id", userId)
        .order("uploaded_at", { ascending: false });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return statements || [];
    } catch (error) {
      console.error("Error fetching user statements:", error);
      throw error;
    }
  }

  /**
   * Delete an uploaded statement
   */
  static async deleteStatement(
    uploadId: string,
    userId: string
  ): Promise<void> {
    try {
      // Get statement info first
      const { data: statement, error: fetchError } = await supabase
        .from("uploaded_statements")
        .select("file_path")
        .eq("id", uploadId)
        .eq("user_id", userId)
        .single();

      if (fetchError || !statement) {
        throw new Error("Statement not found");
      }

      // Delete file from disk
      try {
        await fs.unlink(statement.file_path);
      } catch (fileError) {
        console.warn("Failed to delete file from disk:", fileError);
        // Continue with database deletion even if file deletion fails
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from("uploaded_statements")
        .delete()
        .eq("id", uploadId)
        .eq("user_id", userId);

      if (deleteError) {
        throw new Error(`Database error: ${deleteError.message}`);
      }
    } catch (error) {
      console.error("Error deleting statement:", error);
      throw error;
    }
  }

  /**
   * Reprocess a failed statement
   */
  static async reprocessStatement(
    uploadId: string,
    userId: string
  ): Promise<void> {
    try {
      // Update status to pending
      const { error } = await supabase
        .from("uploaded_statements")
        .update({
          processing_status: "pending",
          error_message: null,
          processed_at: null,
        })
        .eq("id", uploadId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Restart processing
      this.processStatementAsync(uploadId, true);
    } catch (error) {
      console.error("Error reprocessing statement:", error);
      throw error;
    }
  }

  /**
   * Validate uploaded file
   */
  private static validateFile(file: UploadedFile): void {
    if (!file) {
      throw new Error("No file provided");
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(
        `File size exceeds maximum limit of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }

    if (!this.ALLOWED_TYPES.includes(file.mimetype)) {
      throw new Error(
        `Unsupported file type. Allowed types: ${this.ALLOWED_TYPES.join(", ")}`
      );
    }

    if (!file.originalname.match(/\.(pdf|jpg|jpeg|png|tiff)$/i)) {
      throw new Error("Invalid file extension");
    }
  }

  /**
   * Validate upload options
   */
  private static validateOptions(options: UploadOptions): void {
    if (!options.cardId) {
      throw new Error("Card ID is required");
    }

    if (!options.userId) {
      throw new Error("User ID is required");
    }

    if (
      !options.statementMonth ||
      options.statementMonth < 1 ||
      options.statementMonth > 12
    ) {
      throw new Error("Valid statement month (1-12) is required");
    }

    if (
      !options.statementYear ||
      options.statementYear < 2000 ||
      options.statementYear > new Date().getFullYear() + 1
    ) {
      throw new Error("Valid statement year is required");
    }
  }

  /**
   * Calculate processing progress
   */
  private static calculateProgress(statement: any): {
    stage: "ocr" | "extraction" | "matching" | "completed";
    percentage: number;
  } {
    switch (statement.processing_status) {
      case "pending":
        return { stage: "ocr", percentage: 0 };
      case "processing":
        // Determine stage based on available data
        if (statement.extracted_data) {
          if (statement.transactions_matched > 0) {
            return { stage: "matching", percentage: 80 };
          }
          return { stage: "extraction", percentage: 50 };
        }
        return { stage: "ocr", percentage: 20 };
      case "completed":
        return { stage: "completed", percentage: 100 };
      case "failed":
        return { stage: "ocr", percentage: 0 };
      default:
        return { stage: "ocr", percentage: 0 };
    }
  }

  /**
   * Estimate processing time based on file characteristics
   */
  private static estimateProcessingTime(
    fileSize: number,
    mimeType: string
  ): string {
    const baseTime = mimeType.includes("pdf") ? 30 : 15; // seconds
    const sizeMultiplier = Math.max(1, fileSize / (1024 * 1024)); // MB
    const estimatedSeconds = Math.round(baseTime * sizeMultiplier);

    if (estimatedSeconds < 60) {
      return `${estimatedSeconds} seconds`;
    } else {
      const minutes = Math.round(estimatedSeconds / 60);
      return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    }
  }

  /**
   * Process statement asynchronously
   */
  private static async processStatementAsync(
    uploadId: string,
    autoMatch: boolean
  ): Promise<void> {
    // This will be called asynchronously - we don't await it
    setTimeout(async () => {
      try {
        await this.processStatement(uploadId, autoMatch);
      } catch (error) {
        console.error("Error in async processing:", error);

        // Update status to failed
        await supabase
          .from("uploaded_statements")
          .update({
            processing_status: "failed",
            error_message:
              error instanceof Error
                ? error.message
                : "Unknown processing error",
            processed_at: new Date().toISOString(),
          })
          .eq("id", uploadId);
      }
    }, 1000); // Small delay to allow response to be sent first
  }

  /**
   * Process uploaded statement (OCR + extraction + matching)
   */
  private static async processStatement(
    uploadId: string,
    autoMatch: boolean
  ): Promise<void> {
    try {
      // Update status to processing
      await supabase
        .from("uploaded_statements")
        .update({ processing_status: "processing" })
        .eq("id", uploadId);

      // Get statement info
      const { data: statement, error } = await supabase
        .from("uploaded_statements")
        .select("*")
        .eq("id", uploadId)
        .single();

      if (error || !statement) {
        throw new Error("Statement not found");
      }

      // Step 1: Perform OCR (placeholder - actual OCR implementation will be in OCR service)
      console.log(`Starting OCR for statement ${uploadId}`);
      // const ocrText = await OCRService.performOCR(statement.file_path);

      // Step 2: Extract transactions (placeholder)
      console.log(`Extracting transactions from ${uploadId}`);
      // const extractedTransactions = await this.extractTransactions(ocrText);

      // Step 3: Match with existing transactions if requested
      let matchedTransactions = 0;
      if (autoMatch) {
        console.log(`Matching transactions for ${uploadId}`);
        // matchedTransactions = await this.matchTransactions(statement.user_id, extractedTransactions);
      }

      // For now, simulate successful processing
      const mockExtractedData = {
        ocrProvider: "google_vision",
        transactionsFound: 15,
        discrepancies: [],
        processingTime: "45 seconds",
      };

      // Update completion status
      await supabase
        .from("uploaded_statements")
        .update({
          processing_status: "completed",
          extracted_data: mockExtractedData,
          transactions_extracted: mockExtractedData.transactionsFound,
          transactions_matched: matchedTransactions,
          processed_at: new Date().toISOString(),
        })
        .eq("id", uploadId);

      console.log(`Successfully processed statement ${uploadId}`);
    } catch (error) {
      throw error; // Let the caller handle the error
    }
  }
}
