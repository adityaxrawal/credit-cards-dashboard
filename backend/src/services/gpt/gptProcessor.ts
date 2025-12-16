import OpenAI from 'openai';
import { env } from '../../config/env';
import { CircuitBreaker } from '../../utils/circuitBreaker';
import pool from '../../lib/db';
import { CleanEmailContent } from '../sanitize/sanitizer';
import * as transactionsService from '../transactions.service'; // Keep legacy service for now or refactor later
import { GmailLinkGenerator } from '../../utils/gmailLinkGenerator';

const GPT_MODEL = 'gpt-4o-mini';
const BATCH_SIZE = 40; // STRICT REQUIREMENT
const TIMEOUT_MS = 60000;

export interface GptResult {
    messageId: string;
    status: 'success' | 'ignored' | 'failed';
    transaction?: any;
    confidence?: number;
    reason?: string;
    scanJobId?: string;
    rawEmailId?: string;
}

import { gptQueue } from '../queue/gptQueue';

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

            try {
                // Pass full batch (with scanJobId/rawEmailId) to processBatch
                const results = await this.processBatch(batch, userId);

                // Handle Results
                for (const res of results) {
                    if (res.status === 'success' && res.transaction) {
                        try {
                            // Insert
                            await transactionsService.createTransactionFromExtraction(userId, {
                                ...res.transaction,
                                extractionMethod: 'gpt',
                                confidence: res.confidence
                            }, {
                                id: res.messageId,
                                subject: res.transaction.emailSubject || 'Unknown Subject',
                                body: 'GPT Processed',
                                from: 'GPT Extracted'
                            }, {
                                // PASS TRACEABILITY IDs
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
                            console.error(`[GPT] Failed to insert ${res.messageId}`, err);
                        }
                    } else {
                        // Terminate
                        const { TerminatorService } = await import('../terminator/terminator');
                        await TerminatorService.terminate(
                            userId,
                            res.messageId,
                            res.reason || 'GPT Ignored',
                            'gpt',
                            'UNKNOWN',
                            res.scanJobId // Log termination against job
                        );
                    }
                }
            } catch (e) {
                console.error(`[GPT] Queue processing error`, e);
            }
        });
    }

    /**
     * Process a batch of up to 40 emails
     */
    async processBatch(emails: any[], userId: string): Promise<GptResult[]> {
        if (emails.length === 0) return [];
        if (emails.length > BATCH_SIZE) {
            console.warn(`[GPT] Warning: Batch size ${emails.length} exceeds limit ${BATCH_SIZE}. Truncating or splitting recommended.`);
            // We process anyway but warn. Caller should respect limit.
        }

        const batchId = `gpt_batch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        console.log(`[GPT] Processing batch ${batchId} with ${emails.length} emails`);

        // Log Batch Start
        try {
            await pool.query(
                `INSERT INTO gpt_batch_requests(batch_id, batch_size, email_message_ids, status, processing_started_at)
VALUES($1, $2, $3, 'processing', NOW())`,
                [batchId, emails.length, JSON.stringify(emails.map(e => e.id))]
            );
        } catch (dbErr) {
            console.error(`[GPT] Failed to log batch start: `, dbErr);
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
                console.error(`[GPT] Failed to log batch completion: `, dbErr);
            }

            if (!content) throw new Error('Empty GPT response');

            const json = JSON.parse(content);
            const results = json.results || [];

            // 3. Map Results
            return this.mapResults(emails, results, batchId, userId);

        } catch (e: any) {
            console.error(`[GPT] Batch ${batchId} failed: `, e);

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
            } catch (dbErr) { console.error(dbErr); }

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

    private buildPrompt(emails: CleanEmailContent[]): any[] {
        const cleanEmails = emails.map(e => ({
            id: e.id,
            subject: e.subject,
            body: e.cleanedBody.substring(0, 500), // Accessing cleanedBody
            from: e.from,
            date: e.date.toISOString()
        }));

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
