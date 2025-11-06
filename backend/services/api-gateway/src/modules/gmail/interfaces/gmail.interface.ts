/**
 * Gmail Module Interfaces
 */

export interface IGmailToken {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface IGmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string;
  subject?: string;
  from?: string;
  to?: string;
  body?: string;
}

export interface IGmailSyncResult {
  success: boolean;
  messageCount: number;
  transactionsExtracted: number;
  errors?: string[];
}

export interface IEmailTransaction {
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  category?: string;
  cardLast4?: string;
}
