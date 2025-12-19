import { apiGet, apiPost } from "./client";

export interface GmailConnectionStatus {
  connected: boolean;
  watchActive?: boolean;
  watchExpiration?: string;
  historyId?: string;
}

export interface ScanStatus {
  jobId: string;
  status: string; // Allow flexible status strings (PENDING, PROCESSING, COMPLETED, FAILED, etc)
  currentStep?: string;
  processed: number;
  total: number;
  fetched?: number;
  progress?: number;
  inserted?: number;
  errors?: number;
  errorList?: any[];
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  currentBatch?: number;
  totalBatches?: number;
}

export const gmailApi = {
  /**
   * Get Gmail connection status
   */
  getStatus: async (): Promise<GmailConnectionStatus> => {
    return apiGet<GmailConnectionStatus>("/api/gmail/status");
  },

  /**
   * Connect Gmail account
   */
  connect: async (refreshToken: string): Promise<GmailConnectionStatus> => {
    return apiPost<GmailConnectionStatus>("/api/gmail/connect", {
      refreshToken,
    });
  },

  /**
   * Disconnect Gmail account
   */
  disconnect: async (): Promise<GmailConnectionStatus> => {
    return apiPost<GmailConnectionStatus>("/api/gmail/disconnect");
  },

  /**
   * Trigger historical scan
   */
  scanHistorical: async (
    fromDate?: Date,
    toDate?: Date
  ): Promise<{ jobId: string; status: string }> => {
    const response = await apiPost<{ data: { jobId: string; status: string } }>(
      "/api/gmail/scan-historical",
      {
        fromDate,
        toDate,
      }
    );
    // Backend returns { data: { jobId, status, ... } }
    return response.data || response as any;
  },

  /**
   * Get scan job status
   */
  getScanStatus: async (jobId: string): Promise<ScanStatus> => {
    const response = await apiGet<{ data: ScanStatus }>(`/api/gmail/jobs/${jobId}`);
    return response.data || response as any;
  },

  /**
   * Get latest scan job
   */
  getLatestJob: async (): Promise<ScanStatus | null> => {
    return apiGet<ScanStatus | null>("/api/gmail/jobs/latest");
  },

  /**
   * Manual map message
   */
  manualMap: async (messageId: string, cardInfo: { last4: string; bankName: string }): Promise<{ jobId: string }> => {
    return apiPost<{ jobId: string }>("/api/gmail/manual-map", {
      messageId,
      cardInfo,
    });
  },

  /**
   * Trigger manual Gmail sync
   */
  syncGmail: async (): Promise<any> => {
    return apiPost<any>("/api/gmail/sync");
  },

  /**
   * Get Gmail OAuth authorization URL
   */
  getAuthUrl: async (): Promise<{ success: boolean; data?: string; error?: string }> => {
    return apiPost<{ success: boolean; data?: string; error?: string }>("/api/gmail/auth");
  },

  /**
   * Get last successful sync timestamp
   */
  getLastSync: async (): Promise<{ lastSync: string | null }> => {
    const response = await apiGet<{ data: { lastSync: string | null } }>("/api/gmail/last-sync");
    return response.data;
  },
};
