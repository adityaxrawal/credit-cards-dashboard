import { Response } from "express";
import { AuthRequest } from "@common/middleware/auth";
import { gmailService } from "./gmail.service";
import { logger } from "shared/monitoring/logger";
import {
  GmailSyncError,
  GmailSyncErrorCode,
  categorizeGmailError,
  logSyncOperation,
  logSyncError,
} from "shared/lib/gmail/syncService";
import { startSpan, captureException } from "shared/monitoring/sentry";

/**
 * Gmail Controller
 * Handles Gmail OAuth, sync, and status endpoints
 * Business logic is in gmail.service.ts
 */

export class GmailController {
  /**
   * @route   POST /api/gmail/auth
   * @desc    Get Gmail OAuth authorization URL
   * @access  Protected
   */
  static async authorize(req: AuthRequest, res: Response): Promise<void> {
    try {
      const authUrl = gmailService.getAuthUrl();
      res.json({ success: true, authUrl });
    } catch (error) {
      logger.error("Gmail auth error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate authorization URL",
      });
    }
  }

  /**
   * @route   GET /api/gmail/callback
   * @desc    Handle Gmail OAuth callback
   * @access  Protected
   */
  static async callback(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      const { code } = req.query;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: "User not authenticated",
        });
        return;
      }

      if (!code || typeof code !== "string") {
        res.status(400).json({
          success: false,
          error: "Authorization code is required",
        });
        return;
      }

      await gmailService.handleCallback(userId, code);

      logger.info("Gmail connected successfully", { userId });

      // Redirect to frontend success page
      res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:3000"}/settings?gmail=connected`
      );
    } catch (error) {
      logger.error("Gmail callback error:", error);

      // Redirect to frontend error page
      res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/settings?gmail=error`);
    }
  }

  /**
   * @route   POST /api/gmail/sync
   * @desc    Sync Gmail emails and extract transactions
   * @access  Protected
   * @returns Structured response with error codes and sync summary
   */
  static async syncEmails(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: GmailSyncErrorCode.GMAIL_NOT_CONNECTED,
        message: "User not authenticated",
      });
      return;
    }

    const startTime = Date.now();
    logSyncOperation("sync_started", userId, { timestamp: new Date().toISOString() });

    return startSpan("gmail.sync", "gmail", async () => {
      try {
        const result = await gmailService.syncUserInbox(userId);
        const processingTime = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

        logSyncOperation("sync_completed", userId, {
          result,
          processingTime,
        });

        res.json({
          success: true,
          summary: {
            emailsScanned: result.processed,
            transactionEmailsFound: result.inserted + result.skipped,
            newTransactions: result.inserted,
            duplicatesSkipped: result.skipped,
            errors: result.errors,
            processingTime,
          },
          errorDetails: result.errorDetails,
        });
      } catch (error) {
        // Categorize and structure the error
        const gmailError = error instanceof GmailSyncError ? error : categorizeGmailError(error);

        // Capture to Sentry
        captureException(gmailError, {
          userId,
          errorCode: gmailError.code,
          retryable: gmailError.retryable,
        });

        logSyncError("sync_failed", userId, gmailError, {
          processingTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        });

        res.status(gmailError.statusCode).json({
          success: false,
          error: gmailError.code,
          message: gmailError.message,
          retryable: gmailError.retryable,
          details: gmailError.details,
        });
      }
    });
  }

  /**
   * @route   GET /api/gmail/status
   * @desc    Get Gmail connection status
   * @access  Protected
   */
  static async getStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: "User not authenticated",
        });
        return;
      }

      const status = await gmailService.getStatus(userId);
      res.json({ success: true, status });
    } catch (error) {
      logger.error("Gmail status error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get Gmail status",
      });
    }
  }

  /**
   * @route   DELETE /api/gmail/revoke
   * @desc    Revoke Gmail access
   * @access  Protected
   */
  static async revoke(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: "User not authenticated",
        });
        return;
      }

      await gmailService.revoke(userId);

      logger.info("Gmail access revoked", { userId });
      res.json({ success: true, message: "Gmail access revoked successfully" });
    } catch (error) {
      logger.error("Gmail revoke error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to revoke Gmail access",
      });
    }
  }
}
