import * as cheerio from 'cheerio';
import { SimplifiedEmail, CleanEmail } from '../../../types/transaction.types';

export type CleanEmailContent = CleanEmail;

export class SanitizerService {
    /**
     * Main Entry Point: Raw Gmail Message -> Clean Text
     * No DB writes. No Classification.
     */
    static async sanitize(
        rawEmail: SimplifiedEmail,
        fetchAttachment?: (msgId: string, attId: string) => Promise<Buffer | null>
    ): Promise<CleanEmail> {

        // 1. Sanitize Body
        let cleanedBody = this.processBody(rawEmail.body, rawEmail.bodyHtml);

        // 2. Extract Raw Attachments (No Parsing)
        const attachments: { filename: string; mimeType: string; data: Buffer }[] = [];

        if (rawEmail.attachments && rawEmail.attachments.length > 0 && fetchAttachment) {
            const pdfAttachments = rawEmail.attachments.filter(att =>
                att.mimeType === 'application/pdf' || att.filename.toLowerCase().endsWith('.pdf')
            );

            if (pdfAttachments.length > 0) {
                const results = await Promise.all(
                    pdfAttachments.map(async (att) => {
                        try {
                            const buffer = await fetchAttachment(rawEmail.messageId, att.id);
                            if (buffer) {
                                return {
                                    filename: att.filename,
                                    mimeType: att.mimeType,
                                    data: buffer
                                };
                            }
                        } catch (err) {
                            console.warn(`[Sanitizer] Failed to fetch attachment ${att.filename} for email ${rawEmail.messageId}`, err);
                        }
                        return null;
                    })
                );

                attachments.push(...results.filter((res): res is NonNullable<typeof res> => res !== null));
            }
        }

        return {
            id: rawEmail.messageId,
            subject: rawEmail.subject,
            from: rawEmail.from,
            internalDate: rawEmail.internalDate,
            cleanedBody,
            hasAttachments: attachments.length > 0,
            attachments: attachments.length > 0 ? attachments : undefined,
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
