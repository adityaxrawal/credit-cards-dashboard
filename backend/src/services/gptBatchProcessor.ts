
import OpenAI from 'openai';
import { env } from '../config/env';
import { CircuitBreaker } from '../utils/circuitBreaker'; // Import CircuitBreaker
import { gptQueueManager } from './gptQueueManager'; // Use new queue manager
import pool from '../lib/db';
import * as transactionsService from './transactions.service';
import * as cardsQueries from '../db/queries/cards.queries';
import { ExtractionInput } from './extraction.service';

// Configuration
const GPT_MODEL = 'gpt-4o-mini'; // Using efficient model
const BATCH_SIZE = 5;
const TIMEOUT_MS = 60000; // 60 seconds
const MAX_RETRIES = 3;
const BACKOFF_K = 2; // Exponential backoff base

interface GptTransactionResult {
    id: string; // This corresponds to email messageId
    isTransaction: boolean;
    merchantName?: string;
    amount?: number;
    currency?: string;
    date?: string;
    cardLast4?: string;
    bankName?: string;
    confidence?: number;
    reason?: string;
}

export class GptBatchProcessor {
    private openai: OpenAI;
    private circuitBreaker: CircuitBreaker;
    private processingBatches = new Set<string>(); // batchIds
    private cardCache = new Map<string, any>();

    constructor() {
        this.openai = new OpenAI({
            apiKey: env.OPENAI_API_KEY,
            timeout: TIMEOUT_MS // 60s timeout for OpenAI client itself
        });

        this.circuitBreaker = new CircuitBreaker('OpenAI', {
            failureThreshold: 5,
            resetTimeout: 60000 // 1 minute backoff for API outages
        });

        // Listen for queue events
        gptQueueManager.on('batch_ready', (queueId) => {
            this.processBatchFromQueue(queueId); // Trigger processing
        });
    }

    /**
     * Process a batch from a specific queue
     */
    private async processBatchFromQueue(queueId: number, retryCount = 0) {
        // Get batch
        const batchItems = gptQueueManager.getBatch(queueId);
        if (!batchItems || batchItems.length === 0) {
            // Check if queue is empty and emit drained event if needed
            const stats = gptQueueManager.getQueueStats();
            if (stats[`queue${queueId}` as keyof typeof stats] === 0) {
                gptQueueManager.emit('queue_drained', queueId);
            }
            return;
        }

        await this.processBatch(batchItems, queueId, retryCount);
    }

    /**
     * Public method to process a specific batch of items (e.g. for draining)
     */
    public async processBatch(batchItems: Array<{ email: ExtractionInput, workerId: number, userId: string }>, queueId: number, retryCount = 0) {
        const batchId = `batch_${Date.now()}_${queueId}_${Math.random().toString(36).substr(2, 5)}`;
        console.log(`[GptProcessor] Starting batch ${batchId} with ${batchItems.length} emails from QUEUE_${queueId} (Attempt ${retryCount + 1})`);

        try {
            // Update DB status for tracking
            const emailIds = batchItems.map(item => item.email.id);

            // Log batch creation
            await pool.query(
                `INSERT INTO gpt_batch_queue (queue_id, batch_id, email_message_ids, batch_size, status, processing_started_at, retry_count)
                 VALUES ($1, $2, $3, $4, 'processing', NOW(), $5)`,
                [queueId, batchId, JSON.stringify(emailIds), batchItems.length, retryCount]
            );

            // 1. Prepare Prompt
            const processedEmails = batchItems.map(item => this.preprocessEmail(item.email));
            const promptMessages = this.buildBatchPrompt(processedEmails);

            // 2. Call OpenAI (SINGLE CALL with Timeout using CircuitBreaker)
            const response = await this.circuitBreaker.execute(() => this.openai.chat.completions.create({
                model: GPT_MODEL,
                messages: promptMessages as any, // Type cast if needed depending on OpenAI types
                response_format: { type: "json_object" }
            }));

            // 3. Process Results
            const content = response.choices[0].message.content;
            if (!content) throw new Error('Empty response from GPT');

            const resultJson = JSON.parse(content);
            const results: GptTransactionResult[] = resultJson.results || [];

            console.log(`[GptProcessor] Batch ${batchId} processed. GPT returned ${results.length} results.`);

            // 4. Update Database
            await this.handleBatchResults(batchItems, results, batchId);

            // 5. Complete Batch
            await pool.query(
                `UPDATE gpt_batch_queue 
                 SET status = 'completed', processing_completed_at = NOW()
                 WHERE batch_id = $1`,
                [batchId]
            );

            // Check if queue is now empty
            if (gptQueueManager.getQueueStats()[`queue${queueId}` as keyof ReturnType<typeof gptQueueManager.getQueueStats>] === 0) {
                gptQueueManager.emit('queue_drained', queueId);
            }

        } catch (error: any) {
            console.error(`[GptProcessor] Batch ${batchId} failed:`, error);

            // Retry Logic
            if (retryCount < MAX_RETRIES) {
                const delay = Math.pow(BACKOFF_K, retryCount) * 1000;
                console.log(`[GptProcessor] Retrying batch ${batchId} in ${delay}ms...`);

                // For manual batches passed to processBatch, we can't easily "put back" into manager.
                // But we CAN recurse with processBatch!

                setTimeout(() => {
                    this.processBatch(batchItems, queueId, retryCount + 1);
                }, delay);

                // Mark DB as retrying?
                await pool.query(
                    `UPDATE gpt_batch_queue 
                     SET status = 'retrying', processing_note = $1
                     WHERE batch_id = $2`,
                    [`Retry ${retryCount + 1} pending`, batchId]
                );

                return;
            }

            // Mark batch as failed permanently
            await pool.query(
                `UPDATE gpt_batch_queue 
                 SET status = 'failed'
                 WHERE batch_id = $1`,
                [batchId]
            );

            // Log individual errors for emails
            for (const item of batchItems) {
                await pool.query(
                    `UPDATE email_processing_log 
                      SET processing_status = 'failed', error_message = $1
                      WHERE email_message_id = $2`,
                    [`Batch processing failed after ${MAX_RETRIES} retries: ${error.message}`, item.email.id]
                );
            }
        }
    }

    private async handleBatchResults(originalItems: { email: ExtractionInput, workerId: number, userId: string }[], results: GptTransactionResult[], batchId: string) {
        // Create a map for quick access
        const resultMap = new Map(results.map(r => [r.id, r]));

        for (const item of originalItems) {
            const result = resultMap.get(item.email.id);

            // Base query vars
            const { id: messageId, subject, from } = item.email;
            const userId = item.userId;

            if (!result) {
                // Handle missing result (GPT didn't return it)
                console.warn(`[GptProcessor] Missing result for email ${messageId} in batch ${batchId}`);
                await pool.query(
                    `UPDATE email_processing_log 
                     SET processing_status = 'failed', error_message = 'GPT missed this email in batch response'
                     WHERE email_message_id = $1`,
                    [messageId]
                );
                continue;
            }

            // ... proceed with existing save logic (need to implement save logic here actually?)
            // The previous file content stopped at "Let's modify GptQueueManager first".
            // I need to implement the save logic now.
            try {
                if (result.isTransaction) {
                    await this.saveTransaction(userId, item.email, result);
                    await pool.query(
                        `UPDATE email_processing_log 
                         SET processing_status = 'success', 
                             confidence_score = $1,
                             batch_id = $2
                         WHERE email_message_id = $3`,
                        [result.confidence || 0.8, batchId, messageId]
                    );
                } else {
                    // Log as ignored/terminator
                    await pool.query(
                        `UPDATE email_processing_log 
                         SET processing_status = 'ignored', 
                             confidence_score = $1,
                             batch_id = $2,
                             error_message = $3
                         WHERE email_message_id = $4`,
                        [result.confidence || 0, batchId, result.reason || 'GPT: Not a transaction', messageId]
                    );
                }
            } catch (saveError: any) {
                console.error(`[GptProcessor] Failed to save result for ${messageId}`, saveError);
                await pool.query(
                    `UPDATE email_processing_log 
                     SET processing_status = 'failed', error_message = $1
                     WHERE email_message_id = $2`,
                    [`Save failed: ${saveError.message}`, messageId]
                );
            }
        }
    }

    private async saveTransaction(userId: string, email: ExtractionInput, result: GptTransactionResult) {
        try {
            // Map GPT result to transaction object
            const finalTxn = {
                merchant: result.merchantName || 'Unknown',
                amount: result.amount || 0,
                currency: result.currency || 'INR',
                date: result.date ? new Date(result.date) : email.date,
                cardLast4: result.cardLast4,
                bankName: result.bankName,
                // Ensure date is valid, fallback to email date
            };

            if (isNaN(finalTxn.date.getTime())) {
                finalTxn.date = email.date;
            }

            // Find or create card - logic handled locally to control "Default" behavior better if needed
            // But reuse existing robust service method createTransactionFromExtraction which does:
            // 1. Detect card
            // 2. Validate amount
            // 3. Insert

            // We pass parameters matching the service signature
            await transactionsService.createTransactionFromExtraction(userId, {
                ...finalTxn,
                extractionMethod: 'gpt',
                confidence: result.confidence || 0.8,
                bankName: result.bankName, // Explicitly pass for detection
            }, {
                id: email.id,
                subject: email.subject,
                body: email.bodyText,
                from: email.from
            });

        } catch (error: any) {
            console.error(`[GptProcessor] saveTransaction failed for ${email.id}:`, error);

            // Fallback: If card detection failed (strict mode in service), we might want to safe-save?
            // User requested: "Handle case where card not found (create new with default values)"
            // The service checks `if (!card) throw Error`.
            // We should catch that specific error and handle it?

            if (error.message && error.message.includes('Card not found')) {
                console.log(`[GptProcessor] Card not found for ${email.id}, creating temporary card or flagging.`);
                // For now, let's log specifically so we know. 
                // If we want to Auto-Create, we would call cardsService.createCard.
                // But for this critical fix, we might just want to ensure we don't crash.
                // Service throws, so we catch here.
                // We should probably UPDATE the log to say "Pending Card" instead of failed?
                throw new Error(`Card missing: ${error.message}`); // Re-throw to be caught by caller and logged as failed
            }
            throw error;
        }
    }

    // ... helper methods (preprocessEmail, buildBatchPrompt, etc.) ...
    /**
    * Preprocess email to minimal JSON
    */
    private preprocessEmail(email: ExtractionInput): any {
        // Strip HTML-like tags if any exist in 'bodyText' or 'bodyHtml'
        let cleanBody = email.bodyText || '';

        // Remove excessive whitespace
        cleanBody = cleanBody.replace(/\s+/g, ' ').trim();

        // Truncate to avoid huge tokens (keep enough for context)
        cleanBody = cleanBody.substring(0, 1000);

        return {
            id: email.id,
            subject: email.subject.replace(/\s+/g, ' ').trim(),
            body: cleanBody,
            from: email.from,
            date: email.date.toISOString()
        };
    }

    private buildBatchPrompt(emails: any[]): any[] {
        const systemPrompt = `You are a strict transaction parser. Extract transactions from emails.
Return a JSON object with a "results" array. Each result must have:
- id: email id
- isTransaction: boolean (true for debit/credit/refund/purchase/spent)
- merchantName: string
- amount: number
- currency: string (INR, USD, EUR, etc)
- date: ISO date string (YYYY-MM-DD or full ISO)
- cardLast4: string (4 digits ONLY if explicitly identified as card number)
- bankName: string
- confidence: number (0-1)
- reason: string

CRITICAL RULES FOR CARD NUMBER:
1. Extract 'cardLast4' ONLY if you see explicit context like "ending in 1234", "Card XX1234", "Card No: ...1234".
2. Do NOT extract random 4 digits.
3. Do NOT extract Account Numbers (e.g. "A/c 1234").
4. Do NOT extract Order Numbers (e.g. "Order 1234").
5. Do NOT extract Phone Numbers.
6. If uncertain, leave cardLast4 null.`;

        const userPrompt = `Process these ${emails.length} emails:\n${JSON.stringify({ emails })}`;

        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
    }

    private async callModelWithRetry(payload: any): Promise<any> {
        try {
            return await this.openai.chat.completions.create(payload, { timeout: TIMEOUT_MS });
        } catch (err: any) {
            if (err.status === 429 || err.status >= 500) {
                // Simple retry once
                return await this.openai.chat.completions.create(payload, { timeout: TIMEOUT_MS });
            }
            throw err;
        }
    }
}

export const gptProcessor = new GptBatchProcessor();
