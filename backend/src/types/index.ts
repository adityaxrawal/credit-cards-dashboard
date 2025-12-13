export interface SimplifiedEmail {
    messageId: string;
    threadId: string;
    from: string;
    to: string;
    subject: string;
    body: string; // Cleaned visible text
    internalDate: number;
}
