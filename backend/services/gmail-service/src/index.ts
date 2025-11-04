import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { gmailClient } from "./gmail-client";
import syncRoutes from "./routes/sync.routes";
// watch-manager removed - zero-cost architecture uses manual sync only

dotenv.config();

const app: Application = express();
const PORT = process.env.GMAIL_SERVICE_PORT || 3004;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "gmail-service", timestamp: new Date().toISOString() });
});

// Mount sync routes
app.use("/gmail", syncRoutes);

/**
 * GET /auth-url
 * Get Gmail OAuth authorization URL
 */
app.get("/auth-url", (req: Request, res: Response) => {
  try {
    const authUrl = gmailClient.getAuthUrl();
    res.json({ success: true, data: { authUrl } });
  } catch (error) {
    console.error("Error generating auth URL:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
});

/**
 * POST /connect
 * Connect Gmail account
 */
app.post("/connect", async (req: Request, res: Response) => {
  try {
    const { userId, authorizationCode } = req.body;

    if (!userId || !authorizationCode) {
      return res.status(400).json({ success: false, error: "userId and authorizationCode required" });
    }

    // Exchange code for tokens
    const tokens = await gmailClient.exchangeCodeForTokens(authorizationCode);
    await gmailClient.storeUserTokens(userId, tokens);

    // Initialize Gmail
    await gmailClient.initializeForUser(userId);
    const email = await gmailClient.getUserProfile(userId);

    // Zero-cost architecture: No watches, manual sync only

    res.json({
      success: true,
      data: {
        connected: true,
        email,
        syncType: "manual",
      },
    });
  } catch (error) {
    console.error("Error connecting Gmail:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
});

/**
 * POST /disconnect
 * Disconnect Gmail account
 */
app.post("/disconnect", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "userId required" });
    }

    const isConnected = await gmailClient.isConnected(userId);
    if (!isConnected) {
      return res.status(400).json({ success: false, error: "Gmail not connected" });
    }

    // Zero-cost architecture: No watches to stop, just disconnect tokens
    await gmailClient.disconnect(userId);

    res.json({ success: true, data: { message: "Gmail disconnected successfully" } });
  } catch (error) {
    console.error("Error disconnecting Gmail:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
});

/**
 * GET /status/:userId
 * Get Gmail connection status
 */
app.get("/status/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const isConnected = await gmailClient.isConnected(userId);

    if (!isConnected) {
      return res.json({
        success: true,
        data: { connected: false, email: null, syncType: "none" },
      });
    }

    const email = await gmailClient.getUserProfile(userId);

    res.json({
      success: true,
      data: {
        connected: true,
        email,
        syncType: "manual",
      },
    });
  } catch (error) {
    console.error("Error getting status:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
});

/**
 * POST /renew-watch
 * DEPRECATED: Zero-cost architecture uses manual sync only
 */
// Endpoint removed - no watches in zero-cost architecture

/**
 * GET /messages/:userId
 * List messages
 */
app.get("/messages/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { query, maxResults, pageToken, after, before } = req.query;

    const isConnected = await gmailClient.isConnected(userId);
    if (!isConnected) {
      return res.status(400).json({ success: false, error: "Gmail not connected" });
    }

    const result = await gmailClient.listMessages(userId, {
      query: query as string,
      maxResults: maxResults ? parseInt(maxResults as string) : undefined,
      pageToken: pageToken as string,
      after: after ? new Date(after as string) : undefined,
      before: before ? new Date(before as string) : undefined,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error listing messages:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
});

/**
 * GET /messages/:userId/:messageId
 * Get message details
 */
app.get("/messages/:userId/:messageId", async (req: Request, res: Response) => {
  try {
    const { userId, messageId } = req.params;

    const isConnected = await gmailClient.isConnected(userId);
    if (!isConnected) {
      return res.status(400).json({ success: false, error: "Gmail not connected" });
    }

    const message = await gmailClient.getMessage(userId, messageId);
    const body = gmailClient.extractMessageBody(message);
    const headers = gmailClient.extractHeaders(message);

    res.json({
      success: true,
      data: {
        id: message.id,
        threadId: message.threadId,
        labelIds: message.labelIds,
        snippet: message.snippet,
        internalDate: message.internalDate,
        headers,
        body,
      },
    });
  } catch (error) {
    console.error("Error getting message:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
});

/**
 * POST /process-notification
 * DEPRECATED: Zero-cost architecture uses manual sync only
 */
// Endpoint removed - no Pub/Sub notifications in zero-cost architecture

/**
 * GET /queue/stats
 * DEPRECATED: Zero-cost architecture - no background queues
 */
// Endpoint removed - no Bull queue in zero-cost architecture

/**
 * GET /templates
 * Get all bank extraction templates
 */
app.get("/templates", (req: Request, res: Response) => {
  try {
    const { BANK_EXTRACTION_PATTERNS } = require("./extraction-patterns");

    const templates = Object.entries(BANK_EXTRACTION_PATTERNS).map(([code, pattern]: [string, any]) => ({
      bankCode: code,
      bankName: pattern.bankName,
      examples: pattern.examples,
    }));

    res.json({ success: true, data: templates });
  } catch (error) {
    console.error("Error getting templates:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
});

/**
 * POST /test-extraction
 * Test transaction extraction without saving
 */
app.post("/test-extraction", async (req: Request, res: Response) => {
  try {
    const { emailData, bankCode } = req.body;

    if (!emailData || !bankCode) {
      return res.status(400).json({ success: false, error: "emailData and bankCode required" });
    }

    const { transactionExtractor } = await import("./transaction-extractor");
    const result = transactionExtractor.extract(emailData, bankCode);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error testing extraction:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
});

/**
 * POST /scan-historical
 * Start historical email scan
 */
app.post("/scan-historical", async (req: Request, res: Response) => {
  try {
    const { userId, startDate, endDate } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "userId required" });
    }

    // Default to last 2 years if not specified
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const { historicalScanner } = await import("./historical-scanner");
    const result = await historicalScanner.startScan(userId, start, end);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error starting historical scan:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
});

/**
 * GET /scan-historical/:jobId
 * Get historical scan job status
 */
app.get("/scan-historical/:jobId", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const { historicalScanner } = await import("./historical-scanner");
    const status = await historicalScanner.getJobStatus(jobId);

    if (!status) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    res.json({ success: true, data: status });
  } catch (error) {
    console.error("Error getting scan status:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Start server
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Gmail Service running on port ${PORT}`);
    console.log("Zero-cost architecture: Manual Gmail sync only");
  });
}

export default app;
