import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import TransactionService from "../services/transaction.service";

const router = Router();
const transactionService = new TransactionService();

// All routes require authentication
router.use(authenticate);

/**
 * GET /transactions
 * Get all transactions for the authenticated user with filtering and pagination
 */
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Extract filters from query params
    const filters = {
      cardId: req.query.cardId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      type: req.query.type as "debit" | "credit" | "refund" | undefined,
      category: req.query.category as string | undefined,
      minAmount: req.query.minAmount
        ? parseFloat(req.query.minAmount as string)
        : undefined,
      maxAmount: req.query.maxAmount
        ? parseFloat(req.query.maxAmount as string)
        : undefined,
      searchQuery: req.query.search as string | undefined,
    };

    // Extract pagination from query params
    const pagination = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      sortBy: (req.query.sortBy as string) || "transaction_date",
      sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc",
    };

    const result = await transactionService.getUserTransactions(
      userId,
      filters,
      pagination
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch transactions";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /transactions/recent
 * Get recent transactions for the authenticated user
 */
router.get("/recent", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const transactions = await transactionService.getRecentTransactions(
      userId,
      limit
    );

    res.json({
      success: true,
      data: { transactions },
    });
  } catch (error) {
    console.error("Error fetching recent transactions:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch recent transactions";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /transactions/statistics
 * Get transaction statistics for the authenticated user
 */
router.get("/statistics", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const filters = {
      cardId: req.query.cardId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };

    const statistics = await transactionService.getTransactionStatistics(
      userId,
      filters
    );

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch statistics";
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /transactions/:id
 * Get a single transaction by ID
 */
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const transactionId = req.params.id;

    const transaction = await transactionService.getTransactionById(
      transactionId,
      userId
    );

    res.json({
      success: true,
      data: { transaction },
    });
  } catch (error) {
    console.error("Error fetching transaction:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch transaction";
    const statusCode = message.includes("not found") ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /transactions
 * Create a new transaction
 */
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const transactionData = req.body;

    const transaction = await transactionService.createTransaction(
      userId,
      transactionData
    );

    res.status(201).json({
      success: true,
      data: { transaction },
      message: "Transaction created successfully",
    });
  } catch (error) {
    console.error("Error creating transaction:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create transaction";
    const statusCode = message.includes("not found") ? 404 : 400;

    res.status(statusCode).json({
      success: false,
      error: message,
    });
  }
});

/**
 * PUT /transactions/:id
 * Update an existing transaction
 */
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const transactionId = req.params.id;
    const updateData = req.body;

    const transaction = await transactionService.updateTransaction(
      transactionId,
      userId,
      updateData
    );

    res.json({
      success: true,
      data: { transaction },
      message: "Transaction updated successfully",
    });
  } catch (error) {
    console.error("Error updating transaction:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update transaction";
    const statusCode = message.includes("not found") ? 404 : 400;

    res.status(statusCode).json({
      success: false,
      error: message,
    });
  }
});

/**
 * DELETE /transactions/:id
 * Delete a transaction
 */
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const transactionId = req.params.id;

    const result = await transactionService.deleteTransaction(
      transactionId,
      userId
    );

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete transaction";
    const statusCode = message.includes("not found") ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      error: message,
    });
  }
});

export default router;
