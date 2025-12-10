import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: Date;
  bodyText: string;
  bodyHtml?: string;
  snippet: string;
  attachments?: { id: string; filename: string; mimeType: string }[];
}

/**
 * Get Gmail client for a user
 */
function getGmailClient(refreshToken: string) {
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth: client as any });
}

// Simple in-memory cache for raw messages to avoid duplicate fetches
const messageCache = new Map<string, { data: gmail_v1.Schema$Message | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

/**
 * Sleep helper for backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable (429 or 5xx)
 */
function isRetryableError(error: any): boolean {
  const status = error?.response?.status || error?.code;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT') return true;
  return false;
}

/**
 * Execute with exponential backoff retry
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  baseDelayMs: number = 1000,
  operationName: string = 'operation'
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isLast = attempt === maxRetries;

      if (isLast || !isRetryableError(error)) {
        console.error(`[GmailClient] ${operationName} failed after ${attempt} attempts:`, error);
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[GmailClient] ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
  throw new Error('Retry logic error');
}

/**
 * Fetch raw Gmail message with retry (for CreditCardMailDetector)
 */
export async function getRawMessage(
  refreshToken: string,
  messageId: string,
  maxRetries: number = 5
): Promise<gmail_v1.Schema$Message | null> {
  // Check cache first
  const cached = messageCache.get(messageId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  try {
    const gmail = getGmailClient(refreshToken);

    const response = await withRetry(
      () => gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      }),
      maxRetries,
      1000,
      `getRawMessage(${messageId})`
    );

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
 * Fetch a single Gmail message
 */
export async function getMessage(
  refreshToken: string,
  messageId: string
): Promise<GmailMessage | null> {
  try {
    const rawMessage = await getRawMessage(refreshToken, messageId);
    if (!rawMessage) return null;

    const headers = rawMessage.payload?.headers || [];

    const getHeader = (name: string) =>
      headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    let bodyText = '';
    let bodyHtml = '';
    const attachments: { id: string; filename: string; mimeType: string }[] = [];

    const extractBody = (parts: gmail_v1.Schema$MessagePart[]) => {
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }

        // Extract attachments
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            id: part.body.attachmentId,
            filename: part.filename,
            mimeType: part.mimeType || 'application/octet-stream'
          });
        }

        if (part.parts) {
          extractBody(part.parts);
        }
      }
    };

    if (rawMessage.payload?.body?.data) {
      bodyText = Buffer.from(rawMessage.payload.body.data, 'base64').toString('utf-8');
    } else if (rawMessage.payload?.parts) {
      extractBody(rawMessage.payload.parts);
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
      date: new Date(parseInt(rawMessage.internalDate || '0')),
      bodyText,
      bodyHtml,
      snippet: rawMessage.snippet || '',
      attachments: attachments.length > 0 ? attachments : undefined
    };
  } catch (error) {
    console.error('[GmailClient] Error fetching message:', error);
    return null;
  }
}

/**
 * Batch fetch Gmail messages with concurrency control and retry
 */
/**
 * Batch fetch Gmail messages with concurrency control and retry
 */
export async function batchGetMessages(
  refreshToken: string,
  messageIds: string[],
  concurrency: number = 10
): Promise<Array<gmail_v1.Schema$Message | null>> {
  // Use dynamic import for p-limit to support ESM/CommonJS consistency
  const { default: pLimit } = await import('p-limit');
  const limit = pLimit(concurrency);

  const tasks = messageIds.map(id => limit(async () => {
    try {
      // Add small jitter/delay to avoid hitting rate limits effectively
      await sleep(Math.random() * 50);
      return await getRawMessage(refreshToken, id);
    } catch (err) {
      console.error(`[GmailClient] Batch item failed ${id}:`, err);
      return null;
    }
  }));

  return Promise.all(tasks);
}

/**
 * Fetch Gmail history since a historyId with retry
 */
export async function fetchHistory(
  refreshToken: string,
  startHistoryId: string,
  maxResults: number = 100
): Promise<{ messages: Array<{ id: string; threadId: string }>; historyId?: string; hasGap: boolean }> {
  try {
    const gmail = getGmailClient(refreshToken);

    const response = await withRetry(
      () => gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        maxResults,
        historyTypes: ['messageAdded'],
      }),
      3,
      1000,
      `fetchHistory(${startHistoryId})`
    );

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

    return {
      messages,
      historyId: response.data.historyId || undefined,
      hasGap: false
    };
  } catch (error: any) {
    // History gap detected - need full resync
    if (error?.response?.status === 404) {
      console.warn('[GmailClient] History gap detected - full resync required');
      return { messages: [], hasGap: true };
    }

    console.error('[GmailClient] Error fetching history:', error);
    return { messages: [], hasGap: true };
  }
}

/**
 * List Gmail messages with query and retry
 */
export async function listMessages(
  refreshToken: string,
  query: string,
  maxResults: number = 100,
  pageToken?: string
): Promise<{ messages: Array<{ id: string; threadId: string }>; nextPageToken?: string; resultSizeEstimate?: number }> {
  const gmail = getGmailClient(refreshToken);

  const response = await withRetry(
    () => gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
      pageToken,
    }),
    5,
    1000,
    'listMessages'
  );

  const messages = (response.data.messages || [])
    .filter((m): m is { id: string; threadId: string } =>
      typeof m.id === 'string' && typeof m.threadId === 'string'
    );

  return {
    messages,
    nextPageToken: response.data.nextPageToken || undefined,
    resultSizeEstimate: response.data.resultSizeEstimate || undefined
  };
}

/**
 * List ALL Gmail messages (handles pagination automatically)
 */
export async function listAllMessages(
  refreshToken: string,
  query: string,
  onProgress?: (count: number) => void
): Promise<Array<{ id: string; threadId: string }>> {
  const allMessages: Array<{ id: string; threadId: string }> = [];
  let pageToken: string | undefined = undefined;
  let pageCount = 0;

  do {
    const response = await listMessages(refreshToken, query, 500, pageToken);

    allMessages.push(...response.messages);
    pageToken = response.nextPageToken;
    pageCount++;

    if (onProgress) {
      onProgress(allMessages.length);
    }

    console.log(`[GmailClient] Fetched page ${pageCount}: ${allMessages.length} total messages`);
  } while (pageToken);

  return allMessages;
}

/**
 * Check if a message ID has already been processed
 */
export async function isMessageProcessed(
  userId: string,
  messageId: string,
  pool: any
): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT 1 FROM gmail_scanned_emails WHERE user_id = $1 AND message_id = $2 LIMIT 1',
    [userId, messageId]
  );
  return rows.length > 0;
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

    const response = await withRetry(
      () => gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName,
          labelIds: ['INBOX'],
        },
      }),
      3,
      1000,
      'setupWatch'
    );

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
    await gmail.users.stop({ userId: 'me' });
    return true;
  } catch (error) {
    console.error('[GmailClient] Error stopping watch:', error);
    return false;
  }
}

/**
 * Get attachment data with retry
 */
export async function getAttachment(
  refreshToken: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer | null> {
  try {
    const gmail = getGmailClient(refreshToken);

    const response = await withRetry(
      () => gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: attachmentId,
      }),
      3,
      1000,
      `getAttachment(${messageId}/${attachmentId})`
    );

    if (response.data.data) {
      return Buffer.from(response.data.data, 'base64');
    }
    return null;
  } catch (error) {
    console.error('[GmailClient] Error fetching attachment:', error);
    return null;
  }
}

/**
 * Check Gmail API health
 */
export async function checkHealth(refreshToken: string): Promise<boolean> {
  try {
    const gmail = getGmailClient(refreshToken);
    await gmail.users.getProfile({ userId: 'me' });
    return true;
  } catch (error) {
    console.error('[GmailClient] Health check failed:', error);
    return false;
  }
}
