import { Request, Response, NextFunction } from 'express';
import * as gmailService from '../services/gmail.service';
import { FetcherService } from '../services/fetcher.service';

/**
 * Get Gmail connection status
 */
export async function getStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;

    const status = await gmailService.getConnectionStatus(userId);

    res.json({ data: status });
  } catch (error) {
    next(error);
  }
}

/**
 * Connect Gmail
 */
export async function connect(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Refresh token is required',
        },
      });
    }

    const result = await gmailService.connectGmail(userId, refreshToken);

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Disconnect Gmail
 */
export async function disconnect(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;

    const result = await gmailService.disconnectGmail(userId);

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Trigger historical scan
 */
export async function triggerHistoricalScan(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { fromDate, toDate } = req.body;

    const result = await gmailService.triggerHistoricalScan(
      userId,
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined
    );

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Get historical scan status
 */
export async function getHistoricalScanStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { jobId } = req.params;

    const status = await gmailService.getHistoricalScanStatus(userId, jobId);

    res.json({ success: true, data: status });
  } catch (error) {
    console.error('[GmailController] Error getting scan status:', error);
    next(error);
  }
}

/**
 * Get latest job status
 */
export async function getLatestJob(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;

    const job = await gmailService.getLatestJob(userId);

    res.json({ data: job });
  } catch (error) {
    next(error);
  }
}

/**
 * Manual map message
 */
export async function manualMap(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { messageId, cardInfo } = req.body;

    if (!messageId || !cardInfo || !cardInfo.last4 || !cardInfo.bankName) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'messageId and cardInfo (last4, bankName) are required',
        },
      });
    }

    const result = await gmailService.manualMap(userId, messageId, cardInfo);

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle Gmail PubSub Webhook
 * POST /api/gmail/notifications
 */
export async function handleWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Verify token or some secret if configured
    // 2. Parse PubSub message
    const message = req.body.message;
    if (!message || !message.data) {
      return res.status(400).send('Invalid PubSub message format');
    }

    const data = Buffer.from(message.data, 'base64').toString('utf-8');
    const notification = JSON.parse(data);

    const emailAddress = notification.emailAddress;
    const historyId = notification.historyId;

    console.log(`[GmailWebhook] Notification for ${emailAddress}, historyId: ${historyId}`);

    // Resolve userId from emailAddress
    // We need to look up userId by email
    // Since this is a lightweight endpoint, we do it efficiently.
    const { default: pool } = await import('../lib/db');
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [emailAddress]);

    if (rows.length > 0) {
      // Trigger Fetcher Async
      const userId = rows[0].id;
      FetcherService.handleNotification(userId, historyId).catch(console.error);
    } else {
      console.warn(`[GmailWebhook] Unknown user email: ${emailAddress}`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[GmailWebhook] Error:', error);
    // Return 200 to acknowledge PubSub (avoids retries loop) even on error?
    // Usually yes, unless temporary failure.
    res.status(200).send('OK');
  }
}
