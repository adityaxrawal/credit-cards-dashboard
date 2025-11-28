import { apiGet, apiPost } from "./client";

export interface GmailConnectionStatus {
  connected: boolean;
  watchActive?: boolean;
  watchExpiration?: string;
  historyId?: string;
}

export interface ScanStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  processed: number;
  total: number;
  inserted?: number;
  errors?: number;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export const gmailApi = {
  /**
   * Get Gmail connection status
   */
  getStatus: async (): Promise<GmailConnectionStatus> => {
    return apiGet<{ data: GmailConnectionStatus }>("/api/gmail/status").then(
      (res) => res.data
    );
  },

  /**
   * Connect Gmail account
   */
  connect: async (refreshToken: string): Promise<GmailConnectionStatus> => {
    return apiPost<{ data: GmailConnectionStatus }>("/api/gmail/connect", {
      refreshToken,
    }).then((res) => res.data);
  },

  /**
   * Disconnect Gmail account
   */
  disconnect: async (): Promise<GmailConnectionStatus> => {
    return apiPost<{ data: GmailConnectionStatus }>("/api/gmail/disconnect").then(
      (res) => res.data
    );
  },

  /**
   * Trigger historical scan
   */
  scanHistorical: async (
    fromDate?: Date,
    toDate?: Date
  ): Promise<{ jobId: string; status: string }> => {
    return apiPost<{ data: { jobId: string; status: string } }>(
      "/api/gmail/scan-historical",
      {
        fromDate,
        toDate,
      }
    ).then((res) => res.data);
  },

  /**
   * Get scan job status
   */
  getScanStatus: async (jobId: string): Promise<ScanStatus> => {
    return apiGet<{ data: ScanStatus }>(
      `/api/gmail/scan-historical/${jobId}`
    ).then((res) => res.data);
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
};
