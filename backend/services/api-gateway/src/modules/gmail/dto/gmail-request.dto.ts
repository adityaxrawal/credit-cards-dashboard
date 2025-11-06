/**
 * Gmail Request DTOs
 */

export class GmailAuthDto {
  code!: string;
}

export class GmailSyncDto {
  userId!: string;
  forceFullSync?: boolean;
}

export class GmailRevokeDto {
  userId!: string;
}
