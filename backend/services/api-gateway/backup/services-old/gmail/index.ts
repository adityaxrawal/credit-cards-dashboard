/**
 * Gmail Service - Unified exports
 * All Gmail-related functionality in one place
 */

export { GmailClient } from "./gmail-client";
export { TokenManager, createTokenManager } from "./token-manager";
export { EmailFetcher } from "./email-fetcher";
export { TransactionExtractor } from "./transaction-extractor";
export { EmailClassifier } from "./email-classifier";
export type { NormalizedEmail } from "./email-fetcher";
