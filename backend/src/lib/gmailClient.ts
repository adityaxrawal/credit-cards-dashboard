import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import pLimit from 'p-limit';
// import pLimit from 'p-limit'; // Kept as is
import NodeCache from 'node-cache';
import { CircuitBreaker } from '../utils/infrastructure/circuitBreaker';
import { env } from '../config/env';

const oauth2Client = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

// --- Simple Retry Utility ---

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 2, initialDelay = 1000): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      if (attempt > retries) {
        throw error;
      }

      // Retry on 429 (Too Many Requests), 403 (Rate Limit), or 5xx (Server Error)
      const status = error.code || error.response?.status;
      if (status === 429 || status === 403 || (status >= 500 && status < 600)) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        if (status === 429) {
          console.warn(`[GmailClient] Rate limit hit (429). Backing off ${delay}ms...`);
        } else {
          console.warn(`[GmailClient] Error ${status}. Retrying in ${delay}ms... (Attempt ${attempt}/${retries})`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

/**
 * Execute a Gmail API call with retry logic.
 */

// --- Circuit Breaker Configuration ---
/**
 * Execute a Gmail API call with retry logic.
 */

// --- Circuit Breaker Configuration ---
const gmailBreaker = new CircuitBreaker('GmailClient', {
  failureThreshold: 10,
  resetTimeout: 30000, // 30 seconds
});

/**
 * Execute a Gmail API call with retry logic and circuit breaker protection.
 */
async function callGmailApi<T>(fn: () => Promise<T>): Promise<T> {
  // Wrap the retry logic inside the circuit breaker
  // If retries fail, it counts as a failure for the breaker
  return gmailBreaker.execute(() => retryWithBackoff(fn));
}

// --------------------------------------

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  bodyText: string;
  bodyHtml?: string;
  snippet: string;
  attachments?: Array<{ id: string; filename: string; mimeType: string }>;
}

/**
 * Get Gmail client for a user
 */
function getGmailClient(refreshToken: string) {
  const client = new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
  client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth: client as any });
}

// LRU in-memory cache for raw messages to avoid duplicate fetches
// Per-user isolation prevents one user from evicting another user's cache entries
const messageCache = new NodeCache({
  stdTTL: 300,      // 5 minutes TTL
  checkperiod: 60,  // Check for expired entries every 60 seconds
  maxKeys: 500,     // Maximum 500 entries (auto-evicts least recently used)
  useClones: false  // Performance optimization
});

/**
 * Generate cache key with user isolation
 */
function getCacheKey(userId: string, messageId: string): string {
  return `${userId}:${messageId}`;
}

// --- TOKEN BUCKET RATE LIMITER ---
// Gmail API quota: ~250 requests per second per user for most operations
// We target 50-80 requests/sec to leave headroom and prevent quota exhaustion
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens: number = 80, refillRate: number = 80) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    // Refill tokens based on time passed
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;

    if (this.tokens < 1) {
      // Wait until we have a token
      const waitMs = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise(r => setTimeout(r, waitMs));
      this.tokens = 1;
    }

    this.tokens--;
  }
}

// Per-user rate limiters to prevent one user from starving others
const userRateLimiters = new Map<string, TokenBucket>();

// Global fallback rate limiter for calls without userId
// Higher limits as it's a shared pool for system operations or legacy calls
const globalRateLimiter = new TokenBucket(100, 100);

/**
 * Get or create a rate limiter for a specific user
 * Each user gets 20 requests/sec quota (conservative to prevent quota exhaustion)
 */
function getRateLimiter(userId: string): TokenBucket {
  if (!userRateLimiters.has(userId)) {
    userRateLimiters.set(userId, new TokenBucket(20, 20));
  }
  return userRateLimiters.get(userId)!;
}

/**
 * Fetch raw Gmail message
 */
export async function getRawMessage(
  refreshToken: string,
  messageId: string,
  userId?: string  // Optional for backward compatibility
): Promise<gmail_v1.Schema$Message | null> {
  // Check cache first (with user isolation if userId provided)
  const cacheKey = userId ? getCacheKey(userId, messageId) : messageId;
  const cached = messageCache.get<gmail_v1.Schema$Message>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Acquire rate limit token
    // Use per-user limiter if userId is present, otherwise fallback to global limiter
    if (userId) {
      const rateLimiter = getRateLimiter(userId);
      await rateLimiter.acquire();
    } else {
      await globalRateLimiter.acquire();
    }

    const gmail = getGmailClient(refreshToken);

    // No concurrency limit here - caller handles it
    const response = await callGmailApi(() => gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full', // We need full to parse properly
    }));

    // Cache the result (LRU auto-eviction)
    messageCache.set(cacheKey, response.data);

    return response.data;
  } catch (error) {
    console.error(`[GmailClient] Error fetching raw message ${messageId}:`, error);
    return null;
  }
}

/**
 * Parse raw Gmail message into simplified format
 */
export function parseMessage(rawMessage: gmail_v1.Schema$Message): GmailMessage {
  const headers = rawMessage.payload?.headers || [];

  const getHeader = (name: string) =>
    headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

  // Extract body text recursively
  let bodyText = '';
  let bodyHtml = '';
  const attachments: Array<{ id: string; filename: string; mimeType: string }> = [];

  const extractBodyAndAttachments = (parts: gmail_v1.Schema$MessagePart[]) => {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.filename && part.body?.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
        });
      }

      if (part.parts) {
        extractBodyAndAttachments(part.parts);
      }
    }
  };

  if (rawMessage.payload?.body?.data) {
    bodyText = Buffer.from(rawMessage.payload.body.data, 'base64').toString('utf-8');
  } else if (rawMessage.payload?.parts) {
    extractBodyAndAttachments(rawMessage.payload.parts);
  }

  // Fallback: If no plain text, use HTML stripped of tags
  if (!bodyText && bodyHtml) {
    bodyText = bodyHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return {
    id: rawMessage.id!,
    threadId: rawMessage.threadId!,
    subject: getHeader('Subject'),
    from: getHeader('From'),
    to: getHeader('To'),
    date: new Date(parseInt(rawMessage.internalDate || '0')),
    bodyText,
    bodyHtml,
    snippet: rawMessage.snippet || '',
    attachments,
  };
}

/**
 * Fetch a single Gmail message
 */
export async function getMessage(
  refreshToken: string,
  messageId: string
): Promise<GmailMessage | null> {
  try {
    const rawMessage = await getRawMessage(refreshToken, messageId);
    if (!rawMessage) return null;

    return parseMessage(rawMessage);
  } catch (error) {
    console.error('[GmailClient] Error fetching message:', error);
    return null;
  }
}

/**
 * Batch fetch Gmail messages
 * Optimized for High Throughput (Target: 200/sec)
 */
export async function batchGetMessages(
  refreshToken: string,
  messageIds: string[],
  userId: string,  // Required for per-user rate limiting and cache isolation
  concurrency: number = 100 // High concurrency for throughput
): Promise<Array<gmail_v1.Schema$Message>> {
  // Use p-limit to control concurrency.
  // RATIONALE: 100 concurrent requests provides good throughput while
  // leaving headroom for rate limiting and other operations.
  const limit = pLimit(concurrency);

  const start = Date.now();
  console.log(`[GmailClient] Batch fetching ${messageIds.length} messages with concurrency ${concurrency}...`);

  const tasks = messageIds.map(id => limit(() => getRawMessage(refreshToken, id, userId)));

  // Use Promise.allSettled to handle partial failures gracefully
  const results = await Promise.allSettled(tasks);

  // Separate successful and failed fetches
  const successfulResults = results
    .filter((r): r is PromiseFulfilledResult<gmail_v1.Schema$Message | null> => r.status === 'fulfilled');

  const rejectedResults = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected');

  // Extract values and filter out nulls (logical failures from getRawMessage)
  const validMessages = successfulResults
    .map(r => r.value)
    .filter((m): m is gmail_v1.Schema$Message => m !== null);

  const nullCount = successfulResults.length - validMessages.length;
  const failureCount = rejectedResults.length + nullCount;

  // Log failures for debugging
  if (failureCount > 0) {
    console.warn(`[GmailClient] Batch fetch partial failure:`, {
      total: messageIds.length,
      succeeded: validMessages.length,
      failed: failureCount,
      rejections: rejectedResults.length,
      nulls: nullCount, // getRawMessage returned null
      sampleErrors: rejectedResults.slice(0, 3).map(f => f.reason?.message || String(f.reason))
    });
  }

  const duration = Date.now() - start;
  console.log(`[GmailClient] Batch complete. ${validMessages.length}/${messageIds.length} fetched in ${duration}ms (~${Math.round((validMessages.length / duration) * 1000)}/sec)`);

  return validMessages;
}

/**
 * Fetch Gmail history since a historyId
 */
export async function fetchHistory(
  refreshToken: string,
  startHistoryId: string,
  maxResults: number = 100
): Promise<{ messages: Array<{ id: string; threadId: string }> }> {
  try {
    const gmail = getGmailClient(refreshToken);

    const response = await callGmailApi(() => gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      maxResults,
      historyTypes: ['messageAdded'],
    }));

    const messages: Array<{ id: string; threadId: string }> = [];

    if (response.data.history) {
      for (const historyItem of response.data.history) {
        if (historyItem.messagesAdded) {
          for (const added of historyItem.messagesAdded) {
            if (added.message?.id && added.message?.threadId) {
              messages.push({
                id: added.message.id,
                threadId: added.message.threadId,
              });
            }
          }
        }
      }
    }

    return { messages };
  } catch (error) {
    console.error('[GmailClient] Error fetching history:', error);
    return { messages: [] };
  }
}

/**
 * List Gmail messages with query
 */
export async function listMessages(
  refreshToken: string,
  query: string,
  maxResults: number = 100,
  pageToken?: string
): Promise<{ messages: Array<{ id: string; threadId: string }>; nextPageToken?: string; resultSizeEstimate?: number }> {
  try {
    const gmail = getGmailClient(refreshToken);

    const response = await callGmailApi(() => gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
      pageToken,
    }));

    const messages = (response.data.messages || [])
      .filter((m): m is { id: string; threadId: string } =>
        typeof m.id === 'string' && typeof m.threadId === 'string'
      );

    return {
      messages,
      nextPageToken: response.data.nextPageToken || undefined,
      resultSizeEstimate: response.data.resultSizeEstimate || undefined
    };
  } catch (error) {
    console.error('[GmailClient] Error listing messages:', error);
    throw error;
  }
}

/**
 * Setup Gmail watch (Pub/Sub)
 */
export async function setupWatch(
  refreshToken: string,
  topicName: string
): Promise<{ historyId: string; expiration: number } | null> {
  try {
    const gmail = getGmailClient(refreshToken);

    const response = await callGmailApi(() => gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX'],
      },
    }));

    return {
      historyId: response.data.historyId!,
      expiration: parseInt(response.data.expiration!),
    };
  } catch (error) {
    console.error('[GmailClient] Error setting up watch:', error);
    return null;
  }
}

/**
 * Stop Gmail watch
 */
export async function stopWatch(refreshToken: string): Promise<boolean> {
  try {
    const gmail = getGmailClient(refreshToken);
    await callGmailApi(() => gmail.users.stop({ userId: 'me' }));
    return true;
  } catch (error) {
    console.error('[GmailClient] Error stopping watch:', error);
    return false;
  }
}

/**
 * Get attachment data
 */
export async function getAttachment(
  refreshToken: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer | null> {
  try {
    const gmail = getGmailClient(refreshToken);
    const response = await callGmailApi(() => gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    }));

    if (response.data.data) {
      return Buffer.from(response.data.data, 'base64');
    }
    return null;
  } catch (error) {
    console.error('[GmailClient] Error fetching attachment:', error);
    return null;
  }
}
