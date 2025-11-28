import { Request, Response, NextFunction } from 'express';
import * as gmailService from '../services/gmail.service';

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
    
    res.json({ data: status });
  } catch (error) {
    console.error('[GmailController] Error getting scan status:', error);
    next(error);
  }
}
