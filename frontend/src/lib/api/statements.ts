import { apiGet, makeRequest } from './client';

export interface StatementUploadResponse {
  statement: any;
  stats: {
    totalProcessed: number;
    matched: number;
    newInserted: number;
    skipped: number;
  };
}

export interface StatementSummary {
  id: string;
  bill_year: number;
  bill_month: number;
  card_id: string;
  card_name: string;
  bank_name: string;
  card_number_last4: string;
  total_debits: number;
  total_credits: number;
  net_amount: number;
  transaction_count: number;
}

export const statementsApi = {
  getAll: async () => {
    return apiGet<StatementSummary[]>('/api/statements');
  },

  getDetails: async (cardId: string, month: number, year: number) => {
    return apiGet<any>(`/api/statements/${cardId}/${month}/${year}`);
  },

  upload: async (file: File, bankName: string, password?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bankName', bankName);
    if (password) formData.append('password', password);

    // Use makeRequest with explicit body (FormData) and NO Content-Type header (let browser set it)
    // We need to CAST makeRequest as it is internal? Check if I can export it.
    // I will try to import it. If fails, I will use a direct fetch or modify client.ts.
    // Assuming I will modify client.ts to export makeRequest.
    return makeRequest<StatementUploadResponse>('/api/statements/upload', {
      method: 'POST',
      body: formData,
      headers: {
        // Overwriting Content-Type to undefined/null is tricky in JS if the base object has it.
        // But if I change client.ts to check if body is FormData, that works best.
      }
    });
  }
};
