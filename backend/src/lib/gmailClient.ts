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
  // Type assertion needed due to version mismatch between googleapis and google-auth-library
  return google.gmail({ version: 'v1', auth: client as any });
}

/**
 * Fetch raw Gmail message (for CreditCardMailDetector)
 */
export async function getRawMessage(
  refreshToken: string,
  messageId: string
): Promise<gmail_v1.Schema$Message | null> {
  try {
    const gmail = getGmailClient(refreshToken);
    
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    return response.data;
  } catch (error) {
    console.error('[GmailClient] Error fetching raw message:', error);
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

    // Extract body text recursively
    let bodyText = '';
    let bodyHtml = '';

    const extractBody = (parts: gmail_v1.Schema$MessagePart[]) => {
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.parts) {
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
    };
  } catch (error) {
    console.error('[GmailClient] Error fetching message:', error);
    return null;
  }
}

/**
 * Batch fetch Gmail messages (simulated with parallel requests)
 * Note: The Google Node.js client no longer supports multipart batch requests natively.
 * We use high-concurrency parallel fetching which is efficient over HTTP/2.
 */
export async function batchGetMessages(
  refreshToken: string,
  messageIds: string[],
  concurrency: number = 10
): Promise<Array<gmail_v1.Schema$Message | null>> {
  // Dynamic import p-limit because it is an ESM module
  const { default: pLimit } = await import('p-limit');
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
    
    const response = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      maxResults,
      historyTypes: ['messageAdded'],
    });

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
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
      pageToken,
    });

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
    
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX'],
      },
    });

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
 * Get attachment data
 */
export async function getAttachment(
  refreshToken: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer | null> {
  try {
    const gmail = getGmailClient(refreshToken);
    const response = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    if (response.data.data) {
      return Buffer.from(response.data.data, 'base64');
    }
    return null;
  } catch (error) {
    console.error('[GmailClient] Error fetching attachment:', error);
    return null;
  }
}
