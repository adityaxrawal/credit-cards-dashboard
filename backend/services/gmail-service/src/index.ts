import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { gmailClient } from "./gmail-client";
import { gmailWatchManager } from "./watch-manager";

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
    const gmail = await gmailClient.initializeForUser(userId);
    const email = await gmailClient.getUserProfile(userId);

    // Setup watch
    const watch = await gmailWatchManager.setupWatch(userId, gmail);

    res.json({
      success: true,
      data: {
        connected: true,
        email,
        watchExpiration: watch.expiration,
        historyId: watch.historyId,
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

    const gmail = await gmailClient.initializeForUser(userId);
    await gmailWatchManager.stopWatch(userId, gmail);
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
        data: { connected: false, email: null, watchActive: false },
      });
    }

    const email = await gmailClient.getUserProfile(userId);
    const watchStatus = await gmailWatchManager.getWatchStatus(userId);

    res.json({
      success: true,
      data: {
        connected: true,
        email,
        watchActive: watchStatus.active,
        watchExpiration: watchStatus.expiration,
        historyId: watchStatus.historyId,
        needsRenewal: watchStatus.needsRenewal,
      },
    });
  } catch (error) {
    console.error("Error getting status:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
});

/**
 * POST /renew-watch
 * Renew Gmail watch
 */
app.post("/renew-watch", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "userId required" });
    }

    const isConnected = await gmailClient.isConnected(userId);
    if (!isConnected) {
      return res.status(400).json({ success: false, error: "Gmail not connected" });
    }

    const renewed = await gmailWatchManager.renewIfNeeded(userId);
    const watchStatus = await gmailWatchManager.getWatchStatus(userId);

    res.json({
      success: true,
      data: {
        renewed,
        watchActive: watchStatus.active,
        watchExpiration: watchStatus.expiration,
        message: renewed ? "Watch renewed" : "Renewal not needed yet",
      },
    });
  } catch (error) {
    console.error("Error renewing watch:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
});

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
 * Process Pub/Sub notification
 */
app.post("/process-notification", async (req: Request, res: Response) => {
  try {
    const { emailAddress, historyId } = req.body;

    if (!emailAddress || !historyId) {
      return res.status(400).json({ success: false, error: "emailAddress and historyId required" });
    }

    const result = await gmailWatchManager.processNotification({ emailAddress, historyId });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error processing notification:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
});

/**
 * GET /queue/stats
 * Get email processing queue statistics
 */
app.get("/queue/stats", async (req: Request, res: Response) => {
  try {
    const { emailQueue } = await import("./email-queue");
    const stats = await emailQueue.getStats();

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error getting queue stats:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
});

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
  app.listen(PORT, async () => {
    console.log(`Gmail Service running on port ${PORT}`);

    // Start Pub/Sub listener if enabled
    if (process.env.ENABLE_PUBSUB_LISTENER === "true") {
      try {
        const { gmailPubSubListener } = await import("./pubsub-listener");
        gmailPubSubListener.start();
        console.log("Pub/Sub listener started");
      } catch (error) {
        console.error("Failed to start Pub/Sub listener:", error);
      }
    }
  });
}

export default app;
