import { Request, Response, NextFunction } from 'express';

import { gmailService } from '../services/gmail/GmailService';
import logger from '../utils/infrastructure/logger';

/**
 * Get Gmail connection status
 */
export async function getStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;

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
    const userId = req.user.id;
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
    const userId = req.user.id;

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
    const userId = req.user.id;
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
    const userId = req.user.id;
    const { jobId } = req.params;

    const status = await gmailService.getHistoricalScanStatus(userId, jobId);

    res.json({ data: status });
  } catch (error) {
    logger.error('[GmailController] Error getting scan status:', error);
    next(error);
  }
}

/**
 * Get latest job status
 */
export async function getLatestJob(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;

    const job = await gmailService.getLatestJob(userId);

    res.json({ data: job });
  } catch (error) {
    next(error);
  }
}

/**
 * Get last successful sync timestamp
 */
export async function getLastSync(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;

    const lastSync = await gmailService.getLastSuccessfulSync(userId);

    res.json({ data: { lastSync } });
  } catch (error) {
    next(error);
  }
}

/**
 * Manual map message
 */
export async function manualMap(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
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
 * Get terminator report
 */
export async function getTerminatorReport(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const report = await gmailService.getTerminatorReport(
      userId,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: report,
      message: `${report.totalTerminated} emails terminated in the requested period`,
    });
  } catch (error) {
    logger.error('[GmailController] Terminator Report Error:', error);
    next(error);
  }
}

/**
 * Get Pipeline Stats
 */
export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const stats = await gmailService.getPipelineStats(userId);
    res.json({ data: stats });
  } catch (error) {
    next(error);
  }
}

