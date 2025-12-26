import { apiGet, apiPost, apiDelete } from "./client";

export interface Bill {
  id: string;
  card_id: string;
  card_name: string;
  bank_name: string;
  card_number_last4: string;
  bill_month: number;
  bill_year: number;
  bill_amount: number;
  bill_date: string;
  due_date: string;
  payment_amount?: number;
  payment_date?: string;
  payment_status: "pending" | "partial" | "paid" | "overdue";
  payment_method?: string;
  transaction_reference?: string;
  late_fee?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BillFormData {
  cardId: string;
  billMonth: number;
  billYear: number;
  billAmount: number;
  billDate: string;
  dueDate: string;
  paymentStatus?: string;
  notes?: string;
}

export interface BillUpdateData {
  paymentAmount?: number;
  paymentDate?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  transactionReference?: string;
  lateFee?: number;
  notes?: string;
}

export const billsApi = {
  /**
   * Get all bills
   */
  getAll: async (): Promise<Bill[]> => {
    return apiGet<{ data: Bill[] }>("/api/bills").then((res) => res.data);
  },

  /**
   * Get a single bill by ID
   */
  getById: async (id: string): Promise<Bill> => {
    return apiGet<{ data: Bill }>(`/api/bills/${id}`).then((res) => res.data);
  },

  /**
   * Get upcoming bills
   */
  getUpcoming: async (): Promise<Bill[]> => {
    return apiGet<{ data: Bill[] }>("/api/bills/upcoming").then((res) => res.data || []);
  },

  /**
   * Get bills for a specific card
   */
  getCardBills: async (cardId: string): Promise<Bill[]> => {
    return apiGet<{ data: Bill[] }>(`/api/bills/card/${cardId}`).then((res) => res.data);
  },

  /**
   * Create a new bill
   */
  create: async (data: BillFormData): Promise<Bill> => {
    return apiPost<{ data: Bill }>("/api/bills", data).then((res) => res.data);
  },

  /**
   * Update a bill (payment information)
   */
  update: async (id: string, data: BillUpdateData): Promise<Bill> => {
    // Using PUT for update since client.ts doesn't have apiPatch
    return apiPost<{ data: Bill }>(`/api/bills/${id}`, data).then((res) => res.data);
  },

  /**
   * Delete a bill
   */
  delete: async (id: string): Promise<void> => {
    await apiDelete<void>(`/api/bills/${id}`);
  },
};

