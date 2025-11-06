/**
 * Gmail Configuration
 * Google OAuth and Gmail API settings
 */

export const gmailConfig = {
  // OAuth Credentials
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  redirectUri: process.env.GOOGLE_REDIRECT_URI || "",

  // OAuth Scopes
  scopes: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],

  // Gmail API settings
  maxResults: 100, // Max messages per request
  historyTypes: ["messageAdded"],
  labelIds: ["INBOX"],

  // Sync settings
  syncBatchSize: 50,
  syncMaxMessages: 500,

  // Token encryption
  tokenEncryption: {
    algorithm: "aes-256-gcm" as const,
    ivLength: 16,
    authTagLength: 16,
  },

  // Mock mode for testing
  mockMode: process.env.GMAIL_MOCK_MODE === "true",
} as const;

export type GmailConfig = typeof gmailConfig;
