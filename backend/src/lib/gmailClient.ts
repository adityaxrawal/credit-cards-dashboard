import { google } from 'googleapis';
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
 * Fetch a single Gmail message
 */
export async function getMessage(
  refreshToken: string,
  messageId: string
): Promise<GmailMessage | null> {
  try {
    const gmail = getGmailClient(refreshToken);
    
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const message = response.data;
    const headers = message.payload?.headers || [];
    
    const getHeader = (name: string) => 
      headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    // Extract body text
    let bodyText = '';
    let bodyHtml = '';
    
    if (message.payload?.body?.data) {
      bodyText = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    } else if (message.payload?.parts) {
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.mimeType === 'text/html' && part.body?.data) {
          bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    }

    return {
      id: message.id!,
      threadId: message.threadId!,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      date: new Date(parseInt(message.internalDate || '0')),
      bodyText,
      bodyHtml,
      snippet: message.snippet || '',
    };
  } catch (error) {
    console.error('[GmailClient] Error fetching message:', error);
    return null;
  }
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
): Promise<{ messages: Array<{ id: string; threadId: string }>; nextPageToken?: string }> {
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
      nextPageToken: response.data.nextPageToken || undefined
    };
  } catch (error) {
    console.error('[GmailClient] Error listing messages:', error);
    return { messages: [] };
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
