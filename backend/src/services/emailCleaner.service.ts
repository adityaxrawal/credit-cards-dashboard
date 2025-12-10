import { gmail_v1 } from 'googleapis';
import * as cheerio from 'cheerio';

/**
 * Email Cleaning Service
 * 
 * Optimized for Low Latency / Token Efficiency (< 400 tokens).
 * Strategy:
 * 1. Extract raw text.
 * 2. Find "Anchor" (Transaction keywords/amount).
 * 3. Crop Window around anchor.
 * 4. Return heavily trimmed text.
 */
export class EmailCleanerService {

    // Configurable window sizes
    private static ANCHOR_BEFORE = 100;
    private static ANCHOR_AFTER = 800;
    private static MAX_TOTAL_CHARS = 1000;

    /**
     * Clean email text for ML processing
     */
    static async cleanEmailText(message: gmail_v1.Schema$Message): Promise<string> {
        // 1. Extract
        let text = this.extractRawText(message);
        if (!text || text.length < 5) return '';

        // 2. Normalize whitespace (fast)
        text = text.replace(/\s+/g, ' ').trim();

        // 3. Anchor Window Extraction (Focus on Amount/Transaction)
        // This is crucial for keeping input tokens low (< 400 ~ 1.5k chars)
        text = this.extractAnchorWindow(text);

        // 4. Basic cleanup on the window (remove potential quoted garbage left over)
        // Only run if text is still long enough to matter
        if (text.length > 200) {
            text = this.removeQuotedReplies(text);
        }

        return text.trim();
    }

    /**
     * Extract raw text from message payload
     */
    private static extractRawText(message: gmail_v1.Schema$Message): string {
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

        // Prefer Text
        if (bodyText) return bodyText;

        // Fallback to HTML strip
        if (bodyHtml) {
            return this.htmlToText(bodyHtml);
        }

        return '';
    }

    /**
     * Locate the most relevant part of the email (Amount/Transaction) and trim around it.
     */
    private static extractAnchorWindow(text: string): string {
        // Pattern matches: 
        // Currency: INR, Rs, $, USD
        // Keywords: amount, spent, debited, charged, paid, transaction, otp
        const anchorRegex = /(?:INR|Rs\.?|USD|EUR|amount|spent|debited|charged|paid|transaction|otp)/i;

        const match = text.match(anchorRegex);

        // If no anchor, likely not a transaction or very short.
        if (!match || match.index === undefined) {
            // Return first N chars as fallback
            return text.substring(0, this.MAX_TOTAL_CHARS);
        }

        // Crop Window
        const startIdx = Math.max(0, match.index - this.ANCHOR_BEFORE);
        const endIdx = Math.min(text.length, match.index + this.ANCHOR_AFTER);

        return text.substring(startIdx, endIdx);
    }

    private static htmlToText(html: string): string {
        try {
            const $ = cheerio.load(html);
            $('script, style, link, meta, [hidden]').remove();
            $('br').replaceWith('\n');
            $('p, div, tr').after('\n');
            return $.root().text();
        } catch (e) {
            return '';
        }
    }

    /**
     * Minimal reply removal (mostly redundant with windowing but good safety)
     */
    private static removeQuotedReplies(text: string): string {
        const patterns = [
            /On\s+.+?wrote:/i,
            /----+\s*Original Message\s*----+/i,
            /From:\s*.+?\n/i,
            /Sent:\s*.+?\n/i
        ];

        for (const p of patterns) {
            const m = text.match(p);
            if (m && m.index !== undefined) {
                // If reply header is found, truncate
                return text.substring(0, m.index);
            }
        }
        return text;
    }
}
