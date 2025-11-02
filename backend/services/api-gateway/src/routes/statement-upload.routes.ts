import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { StatementUploadService } from "../services/statement-upload.service";
import { OCRService } from "../services/ocr.service";

const router = Router();

// Extended request interface for file uploads
interface FileUploadRequest extends AuthRequest {
  file?: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  };
  body: {
    cardId: string;
    statementMonth: string;
    statementYear: string;
    autoMatch?: string | boolean;
  };
}

// All routes require authentication
router.use(authenticate);

/**
 * POST /statements/upload
 * Upload a credit card statement for OCR processing
 * Note: This endpoint expects multipart/form-data with file upload middleware configured at the application level
 */
router.post("/upload", async (req: FileUploadRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    const { cardId, statementMonth, statementYear, autoMatch } = req.body;

    // Validate required fields
    if (!cardId) {
      return res.status(400).json({
        success: false,
        error: "Card ID is required",
      });
    }

    if (!statementMonth || !statementYear) {
      return res.status(400).json({
        success: false,
        error: "Statement month and year are required",
      });
    }

    // Validate month and year
    const month = parseInt(statementMonth);
    const year = parseInt(statementYear);

    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        error: "Invalid statement month (must be 1-12)",
      });
    }

    const currentYear = new Date().getFullYear();
    if (year < 2000 || year > currentYear + 1) {
      return res.status(400).json({
        success: false,
        error: "Invalid statement year",
      });
    }

    // Upload and process the statement
    const result = await StatementUploadService.uploadStatement(
      {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
      {
        userId,
        cardId,
        statementMonth: month,
        statementYear: year,
        autoMatch: autoMatch === "true" || autoMatch === true,
      }
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error uploading statement:", error);
    const message =
      error instanceof Error ? error.message : "Failed to upload statement";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /statements/upload/:uploadId
 * Get upload status and processing progress
 */
router.get("/upload/:uploadId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { uploadId } = req.params;

    if (!uploadId) {
      return res.status(400).json({
        success: false,
        error: "Upload ID is required",
      });
    }

    const status = await StatementUploadService.getUploadStatus(
      uploadId,
      userId
    );

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Error getting upload status:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get upload status";

    if (message.includes("not found")) {
      res.status(404).json({
        success: false,
        error: message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  }
});

/**
 * GET /statements
 * Get all uploaded statements for the user
 */
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { limit = 20, offset = 0, status, cardId } = req.query;

    let statements = await StatementUploadService.getUserStatements(userId);

    // Apply filters
    if (status && typeof status === "string") {
      statements = statements.filter((s) => s.processingStatus === status);
    }

    if (cardId && typeof cardId === "string") {
      statements = statements.filter((s) => s.cardId === cardId);
    }

    // Apply pagination
    const limitNum = parseInt(limit as string) || 20;
    const offsetNum = parseInt(offset as string) || 0;
    const paginatedStatements = statements.slice(
      offsetNum,
      offsetNum + limitNum
    );

    res.json({
      success: true,
      data: {
        statements: paginatedStatements.map((statement) => ({
          id: statement.id,
          fileName: statement.fileName,
          fileSize: statement.fileSize,
          statementMonth: statement.statementMonth,
          statementYear: statement.statementYear,
          processingStatus: statement.processingStatus,
          transactionsExtracted: statement.transactionsExtracted,
          transactionsMatched: statement.transactionsMatched,
          uploadedAt: statement.uploadedAt,
          processedAt: statement.processedAt,
          errorMessage: statement.errorMessage,
        })),
        pagination: {
          total: statements.length,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < statements.length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching statements:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch statements";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * DELETE /statements/:statementId
 * Delete an uploaded statement
 */
router.delete("/:statementId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { statementId } = req.params;

    if (!statementId) {
      return res.status(400).json({
        success: false,
        error: "Statement ID is required",
      });
    }

    await StatementUploadService.deleteStatement(statementId, userId);

    res.json({
      success: true,
      message: "Statement deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting statement:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete statement";

    if (message.includes("not found")) {
      res.status(404).json({
        success: false,
        error: message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  }
});

/**
 * POST /statements/:statementId/reprocess
 * Reprocess a failed statement upload
 */
router.post(
  "/:statementId/reprocess",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { statementId } = req.params;

      if (!statementId) {
        return res.status(400).json({
          success: false,
          error: "Statement ID is required",
        });
      }

      await StatementUploadService.reprocessStatement(statementId, userId);

      res.json({
        success: true,
        message: "Statement reprocessing started",
      });
    } catch (error) {
      console.error("Error reprocessing statement:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to reprocess statement";

      if (message.includes("not found")) {
        res.status(404).json({
          success: false,
          error: message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: message,
        });
      }
    }
  }
);

/**
 * GET /statements/:statementId/transactions
 * Get extracted transactions from a processed statement
 */
router.get(
  "/:statementId/transactions",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { statementId } = req.params;
      const {
        matched = "all", // 'matched', 'unmatched', 'all'
        confidence = 0.7,
      } = req.query;

      if (!statementId) {
        return res.status(400).json({
          success: false,
          error: "Statement ID is required",
        });
      }

      // Get statement status first
      const status = await StatementUploadService.getUploadStatus(
        statementId,
        userId
      );

      if (status.status !== "completed") {
        return res.status(400).json({
          success: false,
          error: "Statement is not yet processed",
        });
      }

      // In a real implementation, you would fetch extracted transactions from database
      // For now, return mock data based on the statement results
      const mockTransactions = [
        {
          id: "extracted_1",
          date: "2024-01-15",
          description: "AMAZON PURCHASE",
          amount: -89.99,
          confidence: 0.95,
          matched: true,
          matchedTransactionId: "txn_123",
          category: "Shopping",
        },
        {
          id: "extracted_2",
          date: "2024-01-16",
          description: "GROCERY STORE",
          amount: -145.67,
          confidence: 0.88,
          matched: false,
          matchedTransactionId: null,
          category: "Groceries",
        },
      ];

      // Filter by matching status
      let filteredTransactions = mockTransactions;
      if (matched === "matched") {
        filteredTransactions = mockTransactions.filter((t) => t.matched);
      } else if (matched === "unmatched") {
        filteredTransactions = mockTransactions.filter((t) => !t.matched);
      }

      // Filter by confidence
      const confidenceThreshold = parseFloat(confidence as string) || 0.7;
      filteredTransactions = filteredTransactions.filter(
        (t) => t.confidence >= confidenceThreshold
      );

      res.json({
        success: true,
        data: {
          transactions: filteredTransactions,
          summary: {
            total: filteredTransactions.length,
            matched: filteredTransactions.filter((t) => t.matched).length,
            unmatched: filteredTransactions.filter((t) => !t.matched).length,
            averageConfidence:
              filteredTransactions.reduce((sum, t) => sum + t.confidence, 0) /
              filteredTransactions.length,
          },
          filters: {
            matched,
            confidenceThreshold,
          },
        },
      });
    } catch (error) {
      console.error("Error fetching extracted transactions:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to fetch extracted transactions";

      if (message.includes("not found")) {
        res.status(404).json({
          success: false,
          error: message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: message,
        });
      }
    }
  }
);

/**
 * POST /statements/:statementId/transactions/import
 * Import extracted transactions into user's transaction history
 */
router.post(
  "/:statementId/transactions/import",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { statementId } = req.params;
      const {
        transactionIds = [], // Specific transactions to import, empty array = all unmatched
        overwriteExisting = false,
      } = req.body;

      if (!statementId) {
        return res.status(400).json({
          success: false,
          error: "Statement ID is required",
        });
      }

      // Validate transaction IDs if provided
      if (!Array.isArray(transactionIds)) {
        return res.status(400).json({
          success: false,
          error: "Transaction IDs must be an array",
        });
      }

      // Get statement status first
      const status = await StatementUploadService.getUploadStatus(
        statementId,
        userId
      );

      if (status.status !== "completed") {
        return res.status(400).json({
          success: false,
          error: "Statement is not yet processed",
        });
      }

      // In a real implementation, you would:
      // 1. Fetch extracted transactions from database
      // 2. Filter by transactionIds if provided, otherwise get all unmatched
      // 3. Create new transaction records in the transactions table
      // 4. Update statement record with import status

      // Mock implementation
      const importedCount = transactionIds.length || 3; // Mock 3 transactions imported
      const skippedCount = overwriteExisting ? 0 : 1; // Mock 1 skipped due to duplicate

      res.json({
        success: true,
        data: {
          imported: importedCount,
          skipped: skippedCount,
          message: `Successfully imported ${importedCount} transaction(s)${skippedCount > 0 ? `, skipped ${skippedCount} duplicate(s)` : ""}`,
        },
      });
    } catch (error) {
      console.error("Error importing transactions:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to import transactions";

      if (message.includes("not found")) {
        res.status(404).json({
          success: false,
          error: message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: message,
        });
      }
    }
  }
);

/**
 * GET /statements/formats
 * Get supported file formats and their limitations
 */
router.get("/formats", async (req: AuthRequest, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        supportedFormats: [
          {
            type: "pdf",
            mimeType: "application/pdf",
            maxSize: "50MB",
            description: "PDF credit card statements with text or images",
            ocrRequired: true,
          },
          {
            type: "jpeg",
            mimeType: "image/jpeg",
            maxSize: "50MB",
            description: "JPEG images of credit card statements",
            ocrRequired: true,
          },
          {
            type: "png",
            mimeType: "image/png",
            maxSize: "50MB",
            description: "PNG images of credit card statements",
            ocrRequired: true,
          },
          {
            type: "tiff",
            mimeType: "image/tiff",
            maxSize: "50MB",
            description: "TIFF images of credit card statements",
            ocrRequired: true,
          },
        ],
        limitations: {
          maxFileSize: "50MB",
          maxFilesPerUpload: 1,
          allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png", ".tiff"],
          processingTime:
            "30 seconds - 3 minutes depending on file size and complexity",
        },
        ocrProviders: [
          {
            name: "Google Vision API",
            accuracy: "95%+",
            languages: ["English"],
            features: [
              "Text extraction",
              "Table detection",
              "Handwriting recognition",
            ],
          },
        ],
      },
    });
  } catch (error) {
    console.error("Error fetching format information:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch format information",
    });
  }
});

export default router;
