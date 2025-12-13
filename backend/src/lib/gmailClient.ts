import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import pLimit from 'p-limit';
import { env } from '../config/env';
import { CircuitBreaker } from '../utils/circuitBreaker';

const oauth2Client = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

const gmailCircuitBreaker = new CircuitBreaker('GmailAPI', {
  failureThreshold: 10, // Higher threshold for Gmail as it's chatty
  resetTimeout: 30000 // 30s backoff
});

// --- Rate Limiter & Retry Utilities ---

class RateLimiter {
  private queue: Array<() => void> = [];
  private processing = false;
  private lastRequestTime = 0;
  // Google Gmail Quota varies, but ~250 quota units/sec/user is a safe-ish baseline for high load,
  // but "Queries per minute" (QPM) is often around 600-1200 depending on tier.
  // Let's hold to ~5 requests/sec = 300 QPM to be very safe and avoid locking.
  private minIntervalMs = 200; // 5 req/sec

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;
      const waitTime = Math.max(0, this.minIntervalMs - timeSinceLast);

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      this.lastRequestTime = Date.now();

      // Execute task without awaiting results to prevent head-of-line blocking
      // The promise resolution is handled inside the task wrapper
      task();
    }

    this.processing = false;
  }
}

const gmailRateLimiter = new RateLimiter();

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, initialDelay = 1000): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      // Add 20s timeout per attempt
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), 20000)
      );

      return await Promise.race([fn(), timeoutPromise]) as T;
    } catch (error: any) {
      attempt++;
      if (attempt > retries) {
        throw error;
      }

      // Retry on 429 (Too Many Requests) or 403 (Rate Limit Exceeded) or 5xx (Server Error)
      const status = error.code || error.response?.status;
      if (status === 429 || status === 403 || (status >= 500 && status < 600)) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.warn(`[GmailClient] Rate limit/Error encountered (Status: ${status}). Retrying in ${delay}ms... (Attempt ${attempt}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

// Wrapper for API calls to apply rate limit + retry + circuit breaker
async function callGmailApi<T>(fn: () => Promise<T>): Promise<T> {
  return gmailCircuitBreaker.execute(() => gmailRateLimiter.schedule(() => retryWithBackoff(fn)));
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
  // Type assertion needed due to version mismatch between googleapis and google-auth-library
  return google.gmail({ version: 'v1', auth: client as any });
}

// Simple in-memory cache for raw messages to avoid duplicate fetches
const messageCache = new Map<string, { data: gmail_v1.Schema$Message | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

/**
 * Fetch raw Gmail message (for CreditCardMailDetector)
 */
export async function getRawMessage(
  refreshToken: string,
  messageId: string
): Promise<gmail_v1.Schema$Message | null> {
  // Check cache first
  const cached = messageCache.get(messageId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  try {
    const gmail = getGmailClient(refreshToken);

    const response = await callGmailApi(() => gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    }));

    // Cache the result
    if (messageCache.size >= MAX_CACHE_SIZE) {
      const firstKey = messageCache.keys().next().value;
      if (firstKey) messageCache.delete(firstKey);
    }

    messageCache.set(messageId, {
      data: response.data,
      timestamp: Date.now()
    });

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
 * Optimized with concurrency limit on top of rate limiting.
 */
export async function batchGetMessages(
  refreshToken: string,
  messageIds: string[],
  concurrency: number = 10
): Promise<Array<gmail_v1.Schema$Message | null>> {
  // We use p-limit to control concurrency of *invoking* the getRawMessage function.
  // getRawMessage itself is rate-limited, so even if we launch 50, they will queue up.
  // But limiting concurrency here helps managing memory and event loop.
  const limit = pLimit(concurrency);

  const tasks = messageIds.map(id => limit(() => getRawMessage(refreshToken, id)));
  return Promise.all(tasks);
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
