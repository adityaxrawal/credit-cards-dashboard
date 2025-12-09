import { gmail_v1 } from 'googleapis';
import * as cheerio from 'cheerio';

/**
 * Email Cleaning Service
 * 
 * Implements robust email cleaning pipeline to prepare text for ML classification.
 * Removes noise, quoted replies, signatures, and other irrelevant content.
 */
export class EmailCleanerService {
    /**
     * Clean email text for ML processing
     * @param message Raw Gmail message
     * @returns Cleaned email text (max 20k chars)
     */
    static async cleanEmailText(message: gmail_v1.Schema$Message): Promise<string> {
        const headers = message.payload?.headers || [];
        const getHeader = (name: string) =>
            headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        let bodyText = '';
        let bodyHtml = '';

        // Extract text/plain and text/html
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

        // Prefer text/plain, fallback to HTML
        let cleanedText = bodyText;

        if (!cleanedText || cleanedText.length < 50) {
            if (bodyHtml) {
                cleanedText = this.htmlToText(bodyHtml);
            }
        }

        // Apply cleaning pipeline
        cleanedText = this.removeQuotedReplies(cleanedText);
        cleanedText = this.removeSignatures(cleanedText);
        cleanedText = this.removeDisclaimers(cleanedText);
        cleanedText = this.normalizeWhitespace(cleanedText);

        // Limit to 20k chars
        if (cleanedText.length > 20000) {
            cleanedText = cleanedText.substring(0, 20000);
        }

        return cleanedText.trim();
    }

    /**
     * Convert HTML to clean text
     */
    private static htmlToText(html: string): string {
        const $ = cheerio.load(html);

        // Remove script, style, and hidden elements
        $('script').remove();
        $('style').remove();
        $('[style*="display:none"]').remove();
        $('[style*="display: none"]').remove();
        $('[hidden]').remove();

        // Remove base64 images (they bloat the text)
        $('img[src^="data:"]').remove();

        // Convert line breaks
        $('br').replaceWith('\n');
        $('p').after('\n');
        $('div').after('\n');
        $('tr').after('\n');

        // Get text content
        let text = $('body').length > 0 ? $('body').text() : '';

        // If no body tag, get all text
        if (!text || text.length < 10) {
            text = $.root().text();
        }

        return text;
    }

    /**
     * Remove quoted replies and forwarded content
     */
    private static removeQuotedReplies(text: string): string {
        // Common quoted reply patterns
        const patterns = [
            /On\s+.+?wrote:/gi,
            /----+\s*Original Message\s*----+/gi,
            /----+\s*Forwarded\s+[Mm]essage\s*----+/gi,
            /From:\s*.+?\n/gi,
            /Sent:\s*.+?\n/gi,
            /To:\s*.+?\n/gi,
            /Subject:\s*.+?\n/gi,
            /Begin forwarded message:/gi,
            /\n>\s*.+/gm,  // Lines starting with >
            /^\s*>\s*.+$/gm,  // Quoted lines
        ];

        let cleaned = text;
        for (const pattern of patterns) {
            const match = cleaned.search(pattern);
            if (match !== -1) {
                // Truncate at first quoted section
                cleaned = cleaned.substring(0, match);
                break;
            }
        }

        return cleaned;
    }

    /**
     * Remove email signatures
     */
    private static removeSignatures(text: string): string {
        const signaturePatterns = [
            /--\s*\n.+/s,  // -- followed by signature
            /Sent from my (iPhone|iPad|Android|BlackBerry|Windows Phone)/gi,
            /Get Outlook for (iOS|Android)/gi,
            /Regards,?\n.+/si,
            /Best regards,?\n.+/si,
            /Thanks,?\n.+/si,
            /Sincerely,?\n.+/si,
            /This email and any attachments.+?confidential/gis,
        ];

        let cleaned = text;
        for (const pattern of signaturePatterns) {
            const match = cleaned.search(pattern);
            if (match !== -1) {
                cleaned = cleaned.substring(0, match);
            }
        }

        return cleaned;
    }

    /**
     * Remove disclaimers and legal text
     */
    private static removeDisclaimers(text: string): string {
        const disclaimerPatterns = [
            /DISCLAIMER:?.+/gis,
            /CONFIDENTIALITY NOTICE:?.+/gis,
            /This message is intended.+?confidential/gis,
            /This email contains confidential.+/gis,
            /Please do not reply to this email/gi,
            /This is an automated message/gi,
            /Do not share your (OTP|PIN|password)/gi,
        ];

        let cleaned = text;
        for (const pattern of disclaimerPatterns) {
            cleaned = cleaned.replace(pattern, '');
        }

        return cleaned;
    }

    /**
     * Normalize whitespace while preserving structure
     */
    private static normalizeWhitespace(text: string): string {
        // Replace multiple spaces with single space
        let normalized = text.replace(/[ \t]+/g, ' ');

        // Replace multiple newlines with double newline (preserve paragraphs)
        normalized = normalized.replace(/\n{3,}/g, '\n\n');

        // Remove leading/trailing whitespace from each line
        normalized = normalized.split('\n')
            .map(line => line.trim())
            .join('\n');

        return normalized;
    }
}
