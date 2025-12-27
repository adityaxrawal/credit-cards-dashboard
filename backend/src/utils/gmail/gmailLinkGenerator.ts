export class GmailLinkGenerator {
  /**
   * Generate a deep link to a specific Gmail message
   * @param messageId The unique Gmail message ID (e.g. '18b3...')
   * @param accountIndex The index of the logged-in Gmail account (default 0)
   */
  static generateLink(messageId: string, accountIndex: number = 1): string {
    return `https://mail.google.com/mail/u/${accountIndex}/#inbox/${messageId}`;
  }

  /**
   * Generate a deep link to a specific Gmail thread
   * @param threadId The unique Gmail thread ID
   * @param accountIndex The index of the logged-in Gmail account (default 0)
   */
  static generateThreadLink(threadId: string, accountIndex: number = 1): string {
    return `https://mail.google.com/mail/u/${accountIndex}/#inbox/${threadId}`;
  }
}
