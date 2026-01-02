/**
 * Gmail Service - Facade
 * 
 * This service now acts as a facade, delegating to specialized services.
 * Maintains backward compatibility with existing imports.
 * 
 * DECOMPOSITION (Issue #3):
 * - GmailConnectionService → connect, disconnect, status
 * - HistoricalScanService → trigger, status, jobs
 * - EmailReprocessingService → reprocess, manual map
 * - ManualStatementService → PDF upload processing
 * - IngestionLogService → log retrieval and filtering
 */

import pool from '../../lib/db';
import { Pool } from 'pg';
import * as gmailClient from '../../lib/gmailClient';
import { runHistoricalScan } from '../../jobs/historicalScanner';
import * as cardsQueries from '../../db/queries/cards.queries';
import { encrypt, decrypt } from '../../utils/helpers/encryption';
import { TerminatorService } from '../infrastructure/termination/TerminatorService';
import { universalPipeline } from '../transactions/pipeline/UniversalTransactionPipeline';

// Import decomposed services
import { GmailConnectionService } from './GmailConnectionService';
import { HistoricalScanService } from './HistoricalScanService';
import { EmailReprocessingService, CardInfo } from './EmailReprocessingService';
import { ManualStatementService, StatementData } from './ManualStatementService';
import { IngestionLogService, IngestionLogFilters } from './IngestionLogService';

export interface IGmailServiceDependencies {
  gmailClient: typeof gmailClient;
  pool: Pool;
  encrypt: typeof encrypt;
  decrypt: typeof decrypt;
  runHistoricalScan: typeof runHistoricalScan;
  terminatorService: typeof TerminatorService;
  universalPipeline: typeof universalPipeline;
  cardsQueries: typeof cardsQueries;
}

/**
 * GmailService - Facade for backward compatibility
 * 
 * New code should use the specialized services directly:
 * - GmailConnectionService
 * - HistoricalScanService
 * - EmailReprocessingService
 * - ManualStatementService
 * - IngestionLogService
 */
export class GmailService {
  constructor(private deps: IGmailServiceDependencies) { }

  // ============================================
  // Connection Management (delegates to GmailConnectionService)
  // ============================================

  async getConnectionStatus(userId: string) {
    return GmailConnectionService.getConnectionStatus(userId);
  }

  async connectGmail(userId: string, refreshToken: string) {
    return GmailConnectionService.connect(userId, refreshToken);
  }

  async disconnectGmail(userId: string) {
    return GmailConnectionService.disconnect(userId);
  }

  // ============================================
  // Historical Scanning (delegates to HistoricalScanService)
  // ============================================

  async triggerHistoricalScan(userId: string, fromDate?: Date, toDate?: Date) {
    return HistoricalScanService.triggerScan(userId, fromDate, toDate);
  }

  async getHistoricalScanStatus(userId: string, jobId: string) {
    return HistoricalScanService.getScanStatus(userId, jobId);
  }

  async getLatestJob(userId: string) {
    return HistoricalScanService.getLatestJob(userId);
  }

  async getLastSuccessfulSync(userId: string) {
    return HistoricalScanService.getLastSuccessfulSync(userId);
  }

  async triggerIncrementalSync(userId: string) {
    return HistoricalScanService.triggerIncrementalSync(userId);
  }

  // ============================================
  // Email Reprocessing (delegates to EmailReprocessingService)
  // ============================================

  async reprocessSingleEmail(userId: string, messageId: string) {
    return EmailReprocessingService.reprocessEmail(userId, messageId);
  }

  async manualMap(userId: string, messageId: string, cardInfo: CardInfo) {
    return EmailReprocessingService.manualMapCard(userId, messageId, cardInfo);
  }

  async getPipelineStats(userId: string) {
    return EmailReprocessingService.getPipelineStats(userId);
  }

  // ============================================
  // Manual Statement (delegates to ManualStatementService)
  // ============================================

  async processManualStatement(userId: string, data: StatementData) {
    return ManualStatementService.processStatement(userId, data);
  }

  // ============================================
  // Ingestion Logs (delegates to IngestionLogService)
  // ============================================

  async getIngestionLogs(userId: string, filters: IngestionLogFilters) {
    return IngestionLogService.getLogs(userId, filters);
  }

  // ============================================
  // Terminator (still direct, could be extracted)
  // ============================================

  async getTerminatorReport(userId: string, startDate: Date, endDate: Date) {
    return await this.deps.terminatorService.getReport(userId, startDate, endDate);
  }
}

// Default Singleton Instance (for backward compatibility)
export const gmailService = new GmailService({
  gmailClient,
  pool,
  encrypt,
  decrypt,
  runHistoricalScan,
  terminatorService: TerminatorService,
  universalPipeline,
  cardsQueries
});

// Re-export decomposed services for direct use
export { GmailConnectionService } from './GmailConnectionService';
export { HistoricalScanService } from './HistoricalScanService';
export { EmailReprocessingService } from './EmailReprocessingService';
export { ManualStatementService } from './ManualStatementService';
export { IngestionLogService } from './IngestionLogService';
