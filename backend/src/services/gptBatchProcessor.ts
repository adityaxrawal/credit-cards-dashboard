
import OpenAI from 'openai';
import { gptQueueManager } from './gptQueueManager'; // Use new queue manager
import pool from '../lib/db';
import * as transactionsService from './transactions.service';
import * as cardsQueries from '../db/queries/cards.queries';
import { ExtractionInput } from './extraction.service';

// Configuration
const GPT_MODEL = 'gpt-4o-mini'; // Using efficient model
const BATCH_SIZE = 5;
const TIMEOUT_MS = 60000; // 60 seconds

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
    private processingBatches = new Set<string>(); // batchIds
    private cardCache = new Map<string, any>();

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Listen for batch ready events
        gptQueueManager.on('batch_ready', (queueId: number) => {
            this.processBatchFromQueue(queueId);
        });
    }

    /**
     * Process a batch from a specific queue
     */
    private async processBatchFromQueue(queueId: number) {
        // Get batch
        const batchItems = gptQueueManager.getBatch(queueId);
        if (!batchItems || batchItems.length === 0) return;

        const batchId = `batch_${Date.now()}_${queueId}_${Math.random().toString(36).substr(2, 5)}`;
        console.log(`[GptProcessor] Starting batch ${batchId} with ${batchItems.length} emails from QUEUE_${queueId}`);

        try {
            // Update DB status for tracking
            const emailIds = batchItems.map(item => item.email.id);

            // Log batch creation
            await pool.query(
                `INSERT INTO gpt_batch_queue (queue_id, batch_id, email_message_ids, batch_size, status, processing_started_at)
                 VALUES ($1, $2, $3, $4, 'processing', NOW())`,
                [queueId, batchId, JSON.stringify(emailIds), batchItems.length]
            );

            // 1. Prepare Prompt
            const processedEmails = batchItems.map(item => this.preprocessEmail(item.email));
            const prompt = this.buildBatchPrompt(processedEmails);

            // 2. Call OpenAI (SINGLE CALL)
            const response = await this.callModelWithRetry({
                model: GPT_MODEL,
                messages: prompt,
                response_format: { type: 'json_object' }
            });

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

        } catch (error: any) {
            console.error(`[GptProcessor] Batch ${batchId} failed:`, error);

            // Mark batch as failed
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
                    [`Batch processing failed: ${error.message}`, item.email.id]
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
        // Map GPT result to transaction object
        const finalTxn = {
            merchant: result.merchantName || 'Unknown',
            amount: result.amount || 0,
            currency: result.currency || 'INR',
            date: result.date ? new Date(result.date) : email.date,
            cardLast4: result.cardLast4,
            bankName: result.bankName
        };

        // Call transaction service (assuming existing service)
        await transactionsService.createTransactionFromExtraction(userId, {
            ...finalTxn,
            extractionMethod: 'gpt',
            confidence: result.confidence || 0.8
        }, {
            id: email.id,
            subject: email.subject,
            body: email.bodyText,
            from: email.from
        });
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
        const systemPrompt = `You are a transaction extractor.
return JSON object with "results" array.`;
        const userPrompt = `Process ${emails.length} emails.
         ${JSON.stringify({ emails })}`;

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
