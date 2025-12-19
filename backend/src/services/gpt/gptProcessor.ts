import OpenAI from 'openai';
import { env } from '../../config/env';
import { CircuitBreaker } from '../../utils/circuitBreaker';
import pool from '../../lib/db';
import { CleanEmailContent } from '../sanitize/sanitizer';
import { ResolutionService } from '../cards/resolution.service';
import { GmailLinkGenerator } from '../../utils/gmailLinkGenerator';
import { gptQueue } from '../queue/gptQueue';
import pLimit from 'p-limit'; // limit concurrency
import logger from '../../utils/logger';

const GPT_MODEL = 'gpt-4o-mini';
const BATCH_SIZE = 5; // STRICT REQUIREMENT
const TIMEOUT_MS = 60000;
const limit = pLimit(2); // Max 2 concurrent GPT batches to prevent rate limits / cost spikes

export interface GptResult {
    messageId: string;
    status: 'success' | 'ignored' | 'failed';
    transaction?: any;
    confidence?: number;
    reason?: string;
    scanJobId?: string;
    rawEmailId?: string;
}

export class GptProcessor {
    private openai: OpenAI;
    private circuitBreaker: CircuitBreaker;

    constructor() {
        this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: TIMEOUT_MS });
        this.circuitBreaker = new CircuitBreaker('OpenAI', { failureThreshold: 5, resetTimeout: 60000 });

        // Listen to queue
        gptQueue.on('batch_ready', async (batch: any[]) => {
            if (batch.length === 0) return;
            const userId = batch[0].userId;

            // Execute with concurrency limit
            limit(async () => {
                try {
                    // Pass full batch (with scanJobId/rawEmailId) to processBatch
                    const results = await this.processBatch(batch, userId);

                    // Handle Results
                    for (const res of results) {
                        if (res.status === 'success' && res.transaction) {
                            try {
                                // Insert
                                await ResolutionService.resolveAndCreateTransaction(userId, {
                                    ...res.transaction,
                                    date: new Date(res.transaction.date), // Ensure date is a Date object
                                    extractionMethod: 'gpt',
                                    confidence: 1.0 // GPT assumed matches are verified
                                }, {
                                    id: res.messageId,
                                    subject: res.transaction.emailSubject || 'Unknown Subject',
                                    body: 'GPT Processed', // Original body was 'GPT Processed'
                                    from: 'GPT Extracted' // Original from was 'GPT Extracted'
                                }, {
                                    scanJobId: res.scanJobId,
                                    rawEmailId: res.rawEmailId
                                });

                                // Log success
                                await pool.query(
                                    `INSERT INTO email_processing_log (user_id, email_message_id, processing_status, reason, stage, status_category, scan_job_id, created_at)
                                     VALUES ($1, $2, 'success', 'GPT success', 'gpt', 'TRANSACTION', $3, NOW()) 
                                     ON CONFLICT (email_message_id) 
                                     DO UPDATE SET processing_status='success', stage='gpt', scan_job_id=$3`,
                                    [userId, res.messageId, res.scanJobId]
                                );
                            } catch (err) {
                                logger.error(`[GPT] Failed to insert ${res.messageId}`, err);
                            }
                        } else {
                            // Terminate
                            const { TerminatorService } = await import('../terminator/terminator');
                            await TerminatorService.terminate(
                                userId,
                                res.messageId,
                                res.reason || 'GPT Ignored',
                                'gpt',
                                'LOW_CONFIDENCE',
                                res.scanJobId // Log termination against job
                            );
                        }
                    }
                } catch (e) {
                    logger.error(`[GPT] Queue processing error`, e);
                }
            });
        });
    }

    /**
     * Process a batch of up to 40 emails
     */
    async processBatch(emails: any[], userId: string): Promise<GptResult[]> {
        if (emails.length === 0) return [];
        if (emails.length > BATCH_SIZE) {
            logger.warn(`[GPT] Warning: Batch size ${emails.length} exceeds limit ${BATCH_SIZE}. Truncating or splitting recommended.`);
            // We process anyway but warn. Caller should respect limit.
        }

        const batchId = `gpt_batch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        logger.info(`[GPT] Starting batch ${batchId} (Size: ${emails.length})`);
        const startTime = Date.now();

        // Log Batch Start
        try {
            await pool.query(
                `INSERT INTO gpt_batch_requests(batch_id, batch_size, email_message_ids, status, processing_started_at)
                 VALUES($1, $2, $3, 'processing', NOW())`,
                [batchId, emails.length, JSON.stringify(emails.map(e => e.id))]
            );
        } catch (dbErr) {
            logger.error(`[GPT] Failed to log batch start: `, dbErr);
            // Continue processing anyway? Yes, but traceability lost.
        }

        // 1. Build Prompt
        const prompt = this.buildPrompt(emails);

        try {
            // 2. Call OpenAI
            const response = await this.circuitBreaker.execute(() => this.openai.chat.completions.create({
                model: GPT_MODEL,
                messages: prompt as any,
                response_format: { type: "json_object" }
            }));

            const content = response.choices[0].message.content;
            const usage = response.usage;
            const duration = Date.now() - startTime;

            // Log Batch Completion
            try {
                await pool.query(
                    `UPDATE gpt_batch_requests 
                    SET status = 'completed',
                        response_payload = $1,
                        processing_completed_at = NOW(),
                        prompt_tokens = $2,
                        completion_tokens = $3
                    WHERE batch_id = $4`,
                    [content, usage?.prompt_tokens || 0, usage?.completion_tokens || 0, batchId]
                );
            } catch (dbErr) {
                logger.error(`[GPT] Failed to log batch completion: `, dbErr);
            }

            if (!content) throw new Error('Empty GPT response');

            const json = JSON.parse(content);
            const results = json.results || [];

            logger.info(`[GPT] Batch ${batchId} Success in ${duration}ms. Results: ${results.length}`);

            // 3. Map Results
            return this.mapResults(emails, results, batchId, userId);

        } catch (e: any) {
            const duration = Date.now() - startTime;
            logger.error(`[GPT] Batch ${batchId} failed in ${duration}ms: `, e);

            // Log Batch Failure
            try {
                await pool.query(
                    `UPDATE gpt_batch_requests 
                     SET status = 'failed',
                        processing_note = $1,
                        processing_completed_at = NOW()
                     WHERE batch_id = $2`,
                    [e.message || 'Unknown Error', batchId]
                );
            } catch (dbErr) { logger.error(dbErr); }

            // Return all as failed
            return emails.map(email => ({
                messageId: email.id,
                status: 'failed',
                reason: `GPT Error: ${e.message || 'Unknown'} `,
                scanJobId: email.scanJobId,
                rawEmailId: email.rawEmailId
            })) as GptResult[];
        }
    }

    private mapResults(emails: any[], rawResults: any[], batchId: string, userId: string): GptResult[] {
        const emailMap = new Map(emails.map(e => [e.id, e]));

        return rawResults.map((res: any) => {
            const email = emailMap.get(res.id);
            if (!email) return null;

            const baseResult = {
                messageId: res.id,
                scanJobId: email.scanJobId,
                rawEmailId: email.rawEmailId
            };

            if (res.isTransaction && (res.confidence || 0) >= 0.7) { // Confidence Threshold
                // Construct transaction
                const txn = {
                    userId,
                    merchant: res.merchantName || 'Unknown',
                    amount: res.amount,
                    date: res.date ? new Date(res.date) : new Date(email.date),
                    bankName: res.bankName,
                    cardLast4: res.cardLast4,
                    transactionType: 'debit',
                    emailSubject: email.subject,
                    gmailMessageId: email.id,
                    gmailThreadId: email.raw?.threadId || email.threadId, // Support both struct
                    gmailLink: GmailLinkGenerator.generateLink(email.id),
                    confidenceScore: res.confidence,
                    extractionMethod: 'gpt'
                };
                return {
                    ...baseResult,
                    status: 'success',
                    transaction: txn,
                    confidence: res.confidence
                };
            } else {
                return {
                    ...baseResult,
                    status: 'ignored',
                    reason: res.reason || 'Low confidence or not a transaction',
                    confidence: res.confidence
                };
            }
        }).filter(Boolean) as GptResult[];
    }

    private buildPrompt(emails: any[]): any[] {
        // Safely extract email data - emails from queue may have different structure
        const cleanEmails = emails.map(e => {
            // Handle different email formats (CleanEmailContent vs raw email)
            const body = e.cleanedBody || e.body || e.snippet || '';
            const emailDate = e.date ? (e.date instanceof Date ? e.date : new Date(e.date)) : new Date();

            return {
                id: e.id || e.messageId || 'unknown',
                subject: e.subject || '',
                body: typeof body === 'string' ? body.substring(0, 500) : '',
                from: e.from || '',
                date: emailDate.toISOString()
            };
        });

        const system = `Extract credit card spend transactions.Return JSON with "results": [{ id, isTransaction, merchantName, amount, currency, date, cardLast4, bankName, confidence, reason }].
    Rules:
- isTransaction: true ONLY for debits / spends.false for refunds, bills, otp, promos.
     - cardLast4: Extract ONLY if explicit.
     - confidence: 0.0 to 1.0.High confidence(> 0.8) required for automatic insert.
     - date: ISO format.
     `;

        return [
            { role: 'system', content: system },
            { role: 'user', content: JSON.stringify({ emails: cleanEmails }) }
        ];
    }
}

export const gptProcessor = new GptProcessor();
