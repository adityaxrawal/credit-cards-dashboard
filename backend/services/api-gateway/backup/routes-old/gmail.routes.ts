import { Router, Response } from "express";
import { authenticate, AuthRequest } from '@common/middleware/auth';
import { GmailClient } from "../services/gmail/gmail-client";
import { EmailFetcher } from "../services/gmail/email-fetcher";
import { TransactionExtractor } from "../services/gmail/transaction-extractor";
import { supabase } from "../../../../shared/database/supabase";
import { logger } from "../utils/logger";

const router = Router();
const gmailClient = new GmailClient();
const emailFetcher = new EmailFetcher();
const transactionExtractor = new TransactionExtractor();

// All routes require authentication
router.use(authenticate);

/**
 * GET /gmail/auth-url
 * Get Gmail OAuth authorization URL
 */
router.get("/auth-url", async (req: AuthRequest, res: Response) => {
  try {
    const authUrl = gmailClient.getAuthUrl();
    res.json({ success: true, data: { authUrl } });
  } catch (error) {
    logger.error("Error generating Gmail auth URL:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate auth URL",
    });
  }
});

/**
 * POST /gmail/connect
 * Connect Gmail for user after OAuth
 */
router.post("/connect", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { authorizationCode } = req.body;

    if (!authorizationCode) {
      return res.status(400).json({
        success: false,
        error: "Authorization code is required",
      });
    }

    // Exchange code for tokens
    const tokens = await gmailClient.exchangeCodeForTokens(authorizationCode);

    // Store tokens for user
    await gmailClient.storeUserTokens(userId, tokens);

    // Get user's Gmail address
    const gmailAddress = await gmailClient.getUserProfile(userId);

    // Update user record with Gmail connection
    await supabase
      .from("users")
      .update({
        gmail_connected: true,
        gmail_email: gmailAddress,
        last_gmail_sync: null, // Will be set on first sync
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    logger.info({ userId, gmailAddress }, "Gmail connected successfully");

    res.json({
      success: true,
      data: {
        gmailAddress,
        connected: true,
      },
    });
  } catch (error) {
    logger.error("Error connecting Gmail:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect Gmail",
    });
  }
});

/**
 * POST /gmail/disconnect
 * Disconnect Gmail for user
 */
router.post("/disconnect", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Clear Gmail tokens and connection status
    await supabase
      .from("users")
      .update({
        gmail_connected: false,
        gmail_email: null,
        gmail_refresh_token: null,
        gmail_access_token: null,
        gmail_token_expiry: null,
        last_gmail_sync: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    logger.info({ userId }, "Gmail disconnected successfully");

    res.json({
      success: true,
      message: "Gmail disconnected successfully",
    });
  } catch (error) {
    logger.error("Error disconnecting Gmail:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to disconnect Gmail",
    });
  }
});

/**
 * GET /gmail/status
 * Get Gmail connection status
 */
router.get("/status", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const { data: user, error } = await supabase
      .from("users")
      .select("gmail_connected, gmail_email, last_gmail_sync")
      .eq("id", userId)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        connected: user?.gmail_connected || false,
        gmailAddress: user?.gmail_email || null,
        lastSync: user?.last_gmail_sync || null,
      },
    });
  } catch (error) {
    logger.error("Error getting Gmail status:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get Gmail status",
    });
  }
});

/**
 * POST /gmail/sync
 * Manual Gmail sync - fetch and extract transactions from emails
 */
router.post("/sync", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Check if Gmail is connected
    const { data: user } = await supabase
      .from("users")
      .select("gmail_connected, last_gmail_sync")
      .eq("id", userId)
      .single();

    if (!user?.gmail_connected) {
      return res.status(400).json({
        success: false,
        error: "Gmail not connected. Please connect Gmail first.",
      });
    }

    // Initialize Gmail client for user
    const gmail = await gmailClient.initializeForUser(userId);

    // Determine date range for fetching emails
    const lastSync = user.last_gmail_sync
      ? new Date(user.last_gmail_sync)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Last 90 days if first sync

    // List messages since last sync
    const { messages } = await gmail.users.messages.list({
      userId: "me",
      q: `after:${Math.floor(lastSync.getTime() / 1000)} (from:alerts@hdfcbank.net OR from:alerts@icicibank.com OR from:sbi.co.in OR from:alerts.axisbank.com)`,
      maxResults: 500,
    });

    if (!messages || messages.length === 0) {
      logger.info({ userId }, "No new emails to process");
      return res.json({
        success: true,
        data: {
          newTransactions: 0,
          processedEmails: 0,
          lastSync: new Date().toISOString(),
        },
      });
    }

    // Fetch email details
    const emails = await emailFetcher.fetchEmailsBatch(
      gmail,
      messages.map((m) => m.id!)
    );

    // Extract transactions from emails
    let newTransactionsCount = 0;
    for (const email of emails) {
      const transaction = await transactionExtractor.extractTransaction(email);

      if (transaction) {
        // Check for duplicate using email_message_id
        const { data: existing } = await supabase
          .from("transactions")
          .select("id")
          .eq("email_message_id", email.id)
          .single();

        if (!existing) {
          // Save transaction
          const { error } = await supabase.from("transactions").insert({
            user_id: userId,
            ...transaction,
            email_message_id: email.id,
            created_at: new Date().toISOString(),
          });

          if (!error) {
            newTransactionsCount++;
          }
        }
      }
    }

    // Update last sync timestamp
    await supabase
      .from("users")
      .update({
        last_gmail_sync: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    logger.info(
      `Gmail sync completed for user ${userId}: ${newTransactionsCount} new transactions`
    );

    res.json({
      success: true,
      data: {
        newTransactions: newTransactionsCount,
        processedEmails: emails.length,
        lastSync: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error syncing Gmail:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to sync Gmail",
    });
  }
});

export default router;
