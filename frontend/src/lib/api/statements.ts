import { apiGet } from "./client";
import { Transaction } from "@/types";

export interface StatementSummary {
  card_id: string;
  card_name: string;
  bank_name: string;
  card_number_last4: string;
  bill_year: number;
  bill_month: number;
  transaction_count: number;
  total_debits: number;
  total_credits: number;
  net_amount: number;
}

export interface StatementDetails {
  card: {
    id: string;
    card_name: string;
    bank_name: string;
    card_number_last4: string;
    bill_date: number;
    due_date: number;
    credit_limit: number;
  };
  billingPeriod: {
    month: number;
    year: number;
  };
  transactions: Transaction[];
  summary: {
    totalDebits: number;
    totalCredits: number;
    netAmount: number;
    transactionCount: number;
  };
  billPayment?: {
    id: string;
    bill_amount: number;
    payment_amount?: number;
    payment_status: string;
    bill_date: string;
    due_date: string;
  };
}

export const statementsApi = {
  /**
   * Get all statements (monthly summaries)
   */
  getAll: async (): Promise<StatementSummary[]> => {
    return apiGet<{ data: StatementSummary[] }>("/api/statements").then((res) => res.data);
  },

  /**
   * Get statement details for a specific card and billing period
   */
  getDetails: async (cardId: string, month: number, year: number): Promise<StatementDetails> => {
    return apiGet<{ data: StatementDetails }>(
      `/api/statements/${cardId}/${month}/${year}`
    ).then((res) => res.data);
  },

  /**
   * Get all statements for a specific card
   */
  getCardStatements: async (cardId: string): Promise<StatementSummary[]> => {
    return apiGet<{ data: StatementSummary[] }>(
      `/api/statements/card/${cardId}`
    ).then((res) => res.data);
  },
};


