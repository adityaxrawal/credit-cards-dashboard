import { Request, Response } from "express";

/**
 * Gmail Controller
 * Note: Gmail functionality is accessed via src/routes/gmail.routes.ts
 * The actual Gmail business logic is in:
 * - gmail-client.ts: Handles OAuth and Gmail API
 * - email-fetcher.ts: Fetches and processes emails
 * - token-manager.ts: Manages OAuth tokens
 * - transaction-extractor.ts: Extracts transactions from emails
 */

export class GmailController {
  static async authorize(req: Request, res: Response): Promise<void> {
    res.status(501).json({ message: "Use /gmail/auth endpoint from routes" });
  }

  static async syncEmails(req: Request, res: Response): Promise<void> {
    res.status(501).json({ message: "Use /gmail/sync endpoint from routes" });
  }

  static async getStatus(req: Request, res: Response): Promise<void> {
    res.status(501).json({ message: "Use /gmail/status endpoint from routes" });
  }

  static async revoke(req: Request, res: Response): Promise<void> {
    res.status(501).json({ message: "Use /gmail/revoke endpoint from routes" });
  }
}
