export const GmailUtils = {
    /**
     * Generate direct link to a specific Gmail message
     */
    getMailLink(messageId: string): string {
        return `https://mail.google.com/mail/u/0/#inbox/${messageId}`;
    },

    /**
     * Generate direct link to a Gmail thread
     */
    getThreadLink(threadId: string): string {
        return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
    },

    /**
     * Generate link to search for specific subject
     */
    getSearchLink(query: string): string {
        return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(query)}`;
    }
};
