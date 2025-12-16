export interface SimplifiedEmail {
    messageId: string;
    threadId: string;
    from: string;
    to: string;
    subject: string;
    body: string; // Cleaned visible text or snippet
    internalDate: number;
    // New fields for architecture
    bodyText?: string;
    bodyHtml?: string;
    attachments?: {
        id: string;
        filename: string;
        mimeType: string;
        size?: number;
    }[];
}
