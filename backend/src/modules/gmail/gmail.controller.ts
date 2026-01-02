/**
 * Gmail Controller
 * 
 * Handles Gmail integration endpoints.
 * Uses factory pattern for dependency injection.
 * 
 * Part of Issue #12: Controller-Service Dependency Injection
 */

import { Request, Response, NextFunction } from 'express';
import { GmailService } from './gmail.service';
import logger from '@shared/utils/infrastructure/logger';

/**
 * Controller interface for type safety
 */
export interface IGmailController {
  getStatus(req: Request, res: Response, next: NextFunction): Promise<void>;
  connect(req: Request, res: Response, next: NextFunction): Promise<void>;
  disconnect(req: Request, res: Response, next: NextFunction): Promise<void>;
  triggerHistoricalScan(req: Request, res: Response, next: NextFunction): Promise<void>;
  getHistoricalScanStatus(req: Request, res: Response, next: NextFunction): Promise<void>;
  getLatestJob(req: Request, res: Response, next: NextFunction): Promise<void>;
  getLastSync(req: Request, res: Response, next: NextFunction): Promise<void>;
  manualMap(req: Request, res: Response, next: NextFunction): Promise<void>;
  getTerminatorReport(req: Request, res: Response, next: NextFunction): Promise<void>;
  getStats(req: Request, res: Response, next: NextFunction): Promise<void>;
  reprocessEmail(req: Request, res: Response, next: NextFunction): Promise<void>;
  uploadStatement(req: Request, res: Response, next: NextFunction): Promise<void>;
  incrementalSync(req: Request, res: Response, next: NextFunction): Promise<void>;
  getIngestionLogs(req: Request, res: Response, next: NextFunction): Promise<void>;
}

/**
 * Factory function to create Gmail controller with injected dependencies
 */
export function createGmailController(gmailService: GmailService): IGmailController {
  return {
    async getStatus(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const status = await gmailService.getConnectionStatus(userId);
        res.json(status);
      } catch (error) {
        next(error);
      }
    },

    async connect(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        console.log(`[GmailController] Connect Gmail request from user ${userId}`);
        const { refreshToken } = req.body;

        if (!refreshToken) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Refresh token is required',
            },
          }) as any;
        }

        const result = await gmailService.connectGmail(userId, refreshToken);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },

    async disconnect(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const result = await gmailService.disconnectGmail(userId);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },

    async triggerHistoricalScan(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        console.log(`[GmailController] Trigger historical scan request from user ${userId}`, req.body);
        const { fromDate, toDate } = req.body;

        const result = await gmailService.triggerHistoricalScan(
          userId,
          fromDate ? new Date(fromDate) : undefined,
          toDate ? new Date(toDate) : undefined
        );

        res.json(result);
      } catch (error) {
        next(error);
      }
    },

    async getHistoricalScanStatus(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { jobId } = req.params;
        const status = await gmailService.getHistoricalScanStatus(userId, jobId);
        res.json(status);
      } catch (error) {
        logger.error('[GmailController] Error getting scan status:', error);
        next(error);
      }
    },

    async getLatestJob(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const job = await gmailService.getLatestJob(userId);
        res.json({ data: job });
      } catch (error) {
        next(error);
      }
    },

    async getLastSync(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const lastSync = await gmailService.getLastSuccessfulSync(userId);
        res.json({ data: { lastSync } });
      } catch (error) {
        next(error);
      }
    },

    async manualMap(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        console.log(`[GmailController] Manual map request from user ${userId}`, req.body);
        const { messageId, cardInfo } = req.body;

        if (!messageId || !cardInfo || !cardInfo.last4 || !cardInfo.bankName) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'messageId and cardInfo (last4, bankName) are required',
            },
          }) as any;
        }

        const result = await gmailService.manualMap(userId, messageId, cardInfo);
        res.json({ data: result });
      } catch (error) {
        next(error);
      }
    },

    async getTerminatorReport(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const startDate = req.query.startDate
          ? new Date(req.query.startDate as string)
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const endDate = req.query.endDate
          ? new Date(req.query.endDate as string)
          : new Date();

        const report = await gmailService.getTerminatorReport(userId, startDate, endDate);

        res.json({
          success: true,
          data: report,
          message: `${report.totalTerminated} emails terminated in the requested period`,
        });
      } catch (error) {
        logger.error('[GmailController] Terminator Report Error:', error);
        next(error);
      }
    },

    async getStats(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const stats = await gmailService.getPipelineStats(userId);
        res.json({ data: stats });
      } catch (error) {
        next(error);
      }
    },

    async reprocessEmail(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { messageId } = req.params;

        if (!messageId) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'messageId is required',
            },
          }) as any;
        }

        logger.info('[GmailController] Reprocessing email', { userId, messageId });
        const result = await gmailService.reprocessSingleEmail(userId, messageId);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        logger.error('[GmailController] Reprocess error:', error);
        next(error);
      }
    },

    async uploadStatement(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { cardId, statementMonth, statementYear, pdfBase64, password } = req.body;

        if (!cardId || !statementMonth || !statementYear || !pdfBase64) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'cardId, statementMonth, statementYear, and pdfBase64 are required',
            },
          }) as any;
        }

        logger.info('[GmailController] Uploading statement', {
          userId,
          cardId,
          statementMonth,
          statementYear,
        });

        const result = await gmailService.processManualStatement(userId, {
          cardId,
          statementMonth,
          statementYear,
          pdfBase64,
          password,
        });

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        logger.error('[GmailController] Statement upload error:', error);
        next(error);
      }
    },

    async incrementalSync(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        logger.info('[GmailController] Starting incremental sync', { userId });

        const result = await gmailService.triggerIncrementalSync(userId);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        logger.error('[GmailController] Incremental sync error:', error);
        next(error);
      }
    },

    async getIngestionLogs(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const status = req.query.status as string;
        const search = req.query.search as string;

        const result = await gmailService.getIngestionLogs(userId, {
          page,
          limit,
          status,
          search,
        });

        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

// Import the actual service for default instance
import { gmailService } from './gmail.service';

// Create default controller instance with real service
const defaultController = createGmailController(gmailService as GmailService);

// Export individual functions for backward compatibility with existing routes
export const getStatus = defaultController.getStatus;
export const connect = defaultController.connect;
export const disconnect = defaultController.disconnect;
export const triggerHistoricalScan = defaultController.triggerHistoricalScan;
export const getHistoricalScanStatus = defaultController.getHistoricalScanStatus;
export const getLatestJob = defaultController.getLatestJob;
export const getLastSync = defaultController.getLastSync;
export const manualMap = defaultController.manualMap;
export const getTerminatorReport = defaultController.getTerminatorReport;
export const getStats = defaultController.getStats;
export const reprocessEmail = defaultController.reprocessEmail;
export const uploadStatement = defaultController.uploadStatement;
export const incrementalSync = defaultController.incrementalSync;
export const getIngestionLogs = defaultController.getIngestionLogs;
