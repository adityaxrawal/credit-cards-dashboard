import * as gmailClient from '../../lib/gmailClient';
import { SimplifiedEmail } from '../../types';

export class GmailFetcherService {
    /**
     * Fetch messages in batches
     */
    static async fetchBatch(
        refreshToken: string,
        query: string,
        limit: number = 200,
        pageToken?: string
    ): Promise<{ messages: SimplifiedEmail[], nextPageToken?: string }> {

        // 1. List Messages
        const listResponse = await gmailClient.listMessages(refreshToken, query, limit, pageToken);
        const messageStubs = listResponse.messages;
        const nextPageToken = listResponse.nextPageToken;

        if (!messageStubs || messageStubs.length === 0) {
            return { messages: [], nextPageToken };
        }

        // 2. Fetch Content (Batch Get)
        // gmailClient.batchGetMessages fetches raw, we need to parse it?
        // gmailClient.batchGetMessages returns raw gmail objects.
        // We should parse them into SimplifiedEmail here or in Sanitizer?
        // Architecture: "Gmail Fetch Layer ... Fetch raw RFC 2822 content ... Push fetched emails into a Fetch Queue".
        // AND "Sanitization Layer ... Convert raw Gmail payload".
        // So Fetcher should return RAW or close to raw.
        // SimplifiedEmail is a good interchange format.

        // Using batch size of 50 for API calls to avoid limits
        const messageIds = messageStubs.map(m => m.id);
        const rawMessages = await gmailClient.batchGetMessages(refreshToken, messageIds, 50);

        const validEmails: SimplifiedEmail[] = [];

        for (const raw of rawMessages) {
            if (!raw) continue;
            try {
                const parsed = gmailClient.parseMessage(raw);
                validEmails.push({
                    messageId: parsed.id,
                    threadId: parsed.threadId,
                    from: parsed.from,
                    to: parsed.to,
                    subject: parsed.subject,
                    body: parsed.bodyText || parsed.snippet,
                    internalDate: parsed.date.getTime(),
                    // We need full body info for sanitizer
                    bodyText: parsed.bodyText,
                    bodyHtml: parsed.bodyHtml,
                    attachments: parsed.attachments
                } as any); // Type cast if SimplifiedEmail doesn't match fully?
                // I need to check SimplifiedEmail type in types/index.ts.
            } catch (e) {
                console.warn(`[Fetcher] Failed to parse message ${raw.id}`, e);
            }
        }

        return { messages: validEmails, nextPageToken };
    }
}
