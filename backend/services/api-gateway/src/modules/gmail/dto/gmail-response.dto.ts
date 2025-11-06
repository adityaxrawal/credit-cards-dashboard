/**
 * Gmail Response DTOs
 */

export class GmailAuthResponseDto {
  success!: boolean;
  userId!: string;
  message!: string;
}

export class GmailSyncResponseDto {
  success!: boolean;
  messageCount!: number;
  transactionsExtracted!: number;
  errors?: string[];
}

export class GmailStatusResponseDto {
  connected!: boolean;
  email?: string;
  lastSyncAt?: string;
}
