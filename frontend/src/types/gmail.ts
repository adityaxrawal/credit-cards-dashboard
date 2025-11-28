/**
 * Gmail Integration Types
 * Types related to Gmail sync and email processing
 */

/**
 * Gmail integration status
 */
export interface GmailIntegration {
  connected: boolean;
  email?: string;
  last_sync?: string;
  auto_sync: boolean;
  sync_frequency: string;
}
