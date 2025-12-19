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
            const results = (json.results || []) as any[]; // cast to any[]

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

    private mapResults(
        emails: any[],
        rawResults: any[],
        batchId: string,
        userId: string
    ): GptResult[] {
        const emailMap = new Map(emails.map(e => [e.id, e]));

        return rawResults
            .map((res: any) => {
                const email = emailMap.get(res.id);
                if (!email) return null;

                // Only accept if confidence >= 0.60
                if (res.confidence < 0.60) {
                    return {
                        messageId: res.id,
                        scanJobId: email.scanJobId,
                        rawEmailId: email.rawEmailId,
                        status: 'ignored', // treating low confidence as ignored/terminated
                        reason: `Confidence ${res.confidence} below 0.60`,
                        confidence: res.confidence,
                    };
                }

                // Build transaction object
                const txn = {
                    userId,
                    merchant: res.merchant || 'Unknown',
                    amount: res.amount || 0,
                    date: res.transactionDate
                        ? new Date(res.transactionDate)
                        : new Date(email.date),
                    bankName: 'Unknown',
                    cardLast4: res.cardLast4 || '0000',
                    transactionType: 'debit',
                    emailSubject: email.subject,
                    gmailMessageId: email.id,
                    gmailThreadId: email.threadId,
                    confidenceScore: res.confidence,
                    extractionMethod: 'gpt',
                };

                return {
                    messageId: res.id,
                    scanJobId: email.scanJobId,
                    rawEmailId: email.rawEmailId,
                    status: 'success',
                    transaction: txn,
                    confidence: res.confidence,
                };
            })
            .filter(Boolean) as GptResult[];
    }

    private buildPrompt(emails: any[]): any[] {
        const cleanEmails = emails.map(e => ({
            id: e.id || e.messageId,
            subject: e.subject || '',
            body: (e.cleanedBody || e.body || '').substring(0, 500),
            from: e.from || '',
            date: e.date instanceof Date ? e.date.toISOString() : new Date(e.date).toISOString(),
        }));

        const system = `
You are extracting TRANSACTION DETAILS from credit card spend emails.

IMPORTANT: The email has ALREADY been validated as a legitimate credit card spend.
Your job is ONLY to extract details.
DO NOT RE-EVALUATE or RE-CLASSIFY validity. Even if it looks like a refund or notification, extract the details as requested.

**REQUIRED OUTPUT (JSON Array):**
{
  "results": [
    {
      "id": "email_id",
      "merchant": "Merchant name or null",
      "amount": number or null,
      "currency": "INR",
      "cardLast4": "last 4 digits or null",
      "transactionDate": "YYYY-MM-DD or null",
      "confidence": 0.0 to 1.0,
      "extractedFields": ["merchant", "amount", "date"]
    }
  ]
}

**EXTRACTION LOGIC:**
1. Merchant: Look for "at [merchant]", "to [merchant]", "payment to [merchant]"
2. Amount: Extract numeric value, remove ₹, Rs., symbols
3. Card Last 4: Find "ending in 1234", "****1234", or "ending 1234"
4. Date: Prefer explicit date (10-Dec-2025, Dec 10, etc.)
5. Confidence: number of fields extracted / 4.0

**CRITICAL:**
- Return ONLY valid JSON (no markdown)
- All 6 fields required per object
- Set null for missing fields
- confidence 0.0-1.0

**DO NOT:**
- Reject or classify as invalid
- Check for refunds, OTPs, promotions (just extract what you see)
- Validate credit card phrase existence
- Return 'ignored' or 'failed' status inside results - always return extraction objects`;

        const userMessage = `Extract from these emails:\n\n${cleanEmails.map(e =>
            `ID: ${e.id}\nFrom: ${e.from}\nSubject: ${e.subject}\nBody:\n${e.body}`
        ).join('\n---\n')
            }`;

        return [
            { role: 'system', content: system },
            { role: 'user', content: userMessage },
        ];
    }
}

export const gptProcessor = new GptProcessor();
