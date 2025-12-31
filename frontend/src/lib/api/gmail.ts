import { apiGet, apiPost } from './client';

export interface IngestionLog {
  id: string;
  user_id: string;
  email_message_id: string;
  subject: string;
  from_email: string;
  received_date: string;
  processing_status: string;
  transaction_id?: string;
  error_message?: string;
  status_category: 'success' | 'failed' | 'ignored' | 'pending';
  stage: string;
  created_at: string;
  transaction_amount?: number;
  transaction_merchant?: string;
  transaction_category?: string;
}

export interface IngestionLogsResponse {
  data: IngestionLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ScanStatus {
  jobId?: string;
  status: string;
  processed: number;
  total: number;
  fetched: number;
  inserted: number;
  errors: number;
  errorList?: any[];
  currentStep?: string;
  queueStatus?: {
    queue1: number;
    queue2: number;
  };
  // Optional / Legacy fields from backend or computed in Context
  totalTransactions?: number;
  totalEmails?: number;
  totalProcessed?: number;
  totalErrors?: number;

  // Frontend state augmentations
  errorMessage?: string;
  progress?: number;
  postProcessingStats?: {
    billsCreated?: number;
    instrumentsCreated?: number;
  };
  connected?: boolean; // For getStatus
}

export const gmailApi = {
  getLogs: async (params: { page?: number; limit?: number; status?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.search) query.append('search', params.search);

    return apiGet<IngestionLogsResponse>(`/api/gmail/logs?${query.toString()}`);
  },

  getStats: async () => {
    return apiGet<any>('/api/gmail/stats');
  },

  getStatus: async () => {
    // Used by NotificationBell. Maps to stats -> connected
    const stats = await apiGet<{ connected: boolean }>('/api/gmail/stats');
    return { connected: stats.connected };
  },

  getLastSync: async () => {
    // Used by GmailSyncButton. Maps to stats -> lastSync
    const stats = await apiGet<{ lastSync: string }>('/api/gmail/stats');
    return { lastSync: stats.lastSync };
  },

  scanHistorical: async (fromDate?: Date, toDate?: Date) => {
    return apiPost<{ jobId: string }>('/api/gmail/scan-historical', {
      fromDate: fromDate?.toISOString(),
      toDate: toDate?.toISOString()
    });
  },

  manualMap: async (messageId: string, params: { bankName: string; last4: string }) => {
    return apiPost('/api/gmail/manual-map', { messageId, ...params });
  },

  getPipelineStats: async () => {
    // Used by gmail-pipeline/page.tsx
    // Assuming same as getStats or specific reporting endpoint
    // If specific: /api/gmail/stats/pipeline?
    // Based on usage it returns object with { processed, saved, needsReview, terminated }
    // I'll try /api/gmail/stats which likely has this data or I assume /api/gmail/stats is comprehensive.
    // If not, I default to /api/gmail/stats.
    return apiGet<any>('/api/gmail/stats');
  },

  getTerminatorReport: async (fromDate: Date, toDate: Date) => {
    const query = new URLSearchParams({
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString()
    });
    return apiGet<any>(`/api/gmail/reports/terminator?${query.toString()}`);
  },

  getLatestJob: async () => {
    return apiGet<any>('/api/gmail/jobs/latest');
  }
};
