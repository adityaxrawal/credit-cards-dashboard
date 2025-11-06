/**
 * Gmail Module - Unified exports
 * All Gmail-related functionality in one place
 *
 * Note: Gmail routes are currently in src/routes/gmail.routes.ts
 * This module contains the business logic and utilities
 */

export { GmailClient } from "./gmail-client";
export { TokenManager, createTokenManager } from "./token-manager";
export { EmailFetcher } from "./email-fetcher";
export { TransactionExtractor } from "./transaction-extractor";
export { EmailClassifier } from "./email-classifier";
export type { NormalizedEmail } from "./email-fetcher";
export * from "./interfaces/gmail.interface";
export { default as gmailRoutes } from "./gmail.routes";
