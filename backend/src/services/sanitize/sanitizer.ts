import * as cheerio from 'cheerio';
import { SimplifiedEmail } from '../../types';

export interface CleanEmailContent {
    id: string;
    subject: string;
    from: string;
    date: Date;
    cleanedBody: string;
    hasAttachments: boolean;
    attachments?: {
        filename: string;
        mimeType: string;
        data: Buffer;
    }[];
    raw: SimplifiedEmail; // Keep generic reference if needed, but prefer specific fields
}

export class SanitizerService {
    /**
     * Main Entry Point: Raw Gmail Message -> Clean Text
     * No DB writes. No Classification.
     */
    static async sanitize(
        rawEmail: SimplifiedEmail,
        fetchAttachment?: (msgId: string, attId: string) => Promise<Buffer | null>
    ): Promise<CleanEmailContent> {

        // 1. Sanitize Body
        let cleanedBody = this.processBody(rawEmail.body, rawEmail.bodyHtml);

        // 2. Extract Raw Attachments (No Parsing)
        const attachments: { filename: string; mimeType: string; data: Buffer }[] = [];

        if (rawEmail.attachments && rawEmail.attachments.length > 0 && fetchAttachment) {
            for (const att of rawEmail.attachments) {
                // Only fetch PDF attachments
                if (att.mimeType === 'application/pdf' || att.filename.toLowerCase().endsWith('.pdf')) {
                    try {
                        const buffer = await fetchAttachment(rawEmail.messageId, att.id);
                        if (buffer) {
                            attachments.push({
                                filename: att.filename,
                                mimeType: att.mimeType,
                                data: buffer
                            });
                        }
                    } catch (err) {
                        console.warn(`[Sanitizer] Failed to fetch attachment ${att.filename} for email ${rawEmail.messageId}`, err);
                    }
                }
            }
        }

        return {
            id: rawEmail.messageId,
            subject: rawEmail.subject,
            from: rawEmail.from,
            date: new Date(rawEmail.internalDate),
            cleanedBody,
            hasAttachments: attachments.length > 0,
            attachments: attachments.length > 0 ? attachments : undefined,
            raw: rawEmail
        };
    }

    /**
     * Internal: Clean HTML/Text body
     */
    private static processBody(bodyText: string, bodyHtml?: string): string {
        let textToParse = bodyText || '';

        // Optimized HTML processing
        if ((!textToParse || textToParse.length < 50) && bodyHtml) {
            const html = bodyHtml;
            const hasComplexHtml = /<script|<style/i.test(html);

            if (hasComplexHtml) {
                const $ = cheerio.load(html);
                $('script').remove();
                $('style').remove();
                $('br').replaceWith('\n');
                $('p').after('\n');
                textToParse = $('body').text();
            } else {
                textToParse = html.replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<\/p>/gi, '\n')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            }
        }

        // Apply strict text cleaning
        return this.cleanText(textToParse);
    }

    private static cleanText(text: string): string {
        return text
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&#\d+;/g, ' ')
            .replace(/\u00a0/g, ' ')
            .replace(/\r\n/g, ' ')
            .replace(/[\r\n]+/g, ' ')
            .replace(/\t+/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }
}
