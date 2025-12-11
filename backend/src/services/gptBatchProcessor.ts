
import OpenAI from 'openai';
import { batchQueue, EmailBatchJob, SimplifiedEmail } from './batchQueueService';
import pool from '../lib/db';
import * as transactionsService from './transactions.service';
import * as cardsQueries from '../db/queries/cards.queries';

// Configuration
const GPT_MODEL = 'gpt-4.1-nano'; // Enforced model
const MICRO_BATCH_SIZE = 5; // Changed from 100 to prevent hallucinations
const PARALLEL_LIMIT = 5;  // Max parallel micro-batches
const TIMEOUT_MS = 30000; // 30 seconds

interface ProcessedEmail {
    id: string;
    subject: string;
    body: string;
    from: string;
    to: string;
    date: string;
}

interface GptTransactionResult {
    id: string;
    isTransaction: boolean;
    merchantName?: string;
    amount?: number;
    currency?: string;
    date?: string;
    cardLast4?: string;
    bankName?: string;
    confidence?: number;
}

export class GptBatchProcessor {
    private openai: OpenAI;
    private processingCount = 0;
    private readonly CONCURRENCY_LIMIT = 5;
    private processLoopInterval: NodeJS.Timeout | null = null;
    private cardCache = new Map<string, any>();

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        batchQueue.on('enqueue', () => {
            this.triggerProcessing();
        });

        this.startPolling();
    }

    private startPolling() {
        if (this.processLoopInterval) return;
        this.processLoopInterval = setInterval(() => {
            this.triggerProcessing();
        }, 1000);
    }

    public async triggerProcessing() {
        while (this.processingCount < this.CONCURRENCY_LIMIT) {
            const job = await batchQueue.getNextBatch();
            if (!job) break;

            this.processingCount++;
            this.processJobWrapper(job);
        }
    }

    /**
     * Main entry point for processing a job (which contains a list of emails).
     * Requirements: Chunk into 100s, process each chunk.
     */
    private async processJobWrapper(job: EmailBatchJob) {
        try {
            console.log(`[GptProcessor] Processing batch job ${job.batchId} with ${job.emails.length} emails.`);

            // 1. Chunk emails into micro-batches
            const chunks = this.chunkEmails(job.emails, MICRO_BATCH_SIZE);
            let totalInserted = 0;

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                console.log(`[GptProcessor] Processing chunk ${i + 1}/${chunks.length} for batch ${job.batchId}`);

                // 2. Process chunk
                const transactions = await this.processChunk(job.userId, chunk);

                // 3. Insert transactions
                if (transactions.length > 0) {
                    const inserted = await transactionsService.insertFromEmailBulk(job.userId, transactions);
                    totalInserted += inserted.length;
                }
            }

            console.log(`[GptProcessor] Job ${job.batchId} complete. Total inserted: ${totalInserted}`);

            // Update Job Status
            await pool.query(
                `UPDATE gmail_sync_jobs 
                 SET processed_count = processed_count + $1, 
                     saved_count = saved_count + $2,
                     last_update_at = NOW()
                 WHERE id = $3`,
                [job.emails.length, totalInserted, job.jobId]
            );

            await batchQueue.completeBatch(job.batchId);
        } catch (error) {
            console.error(`[GptProcessor] Error processing batch ${job.batchId}:`, error);
            await batchQueue.failBatch(job.batchId, error as Error);
        } finally {
            this.processingCount--;
            this.triggerProcessing();
        }
    }

    /**
     * Chunk emails into arrays of strict size
     */
    private chunkEmails(emails: SimplifiedEmail[], size: number = 100): SimplifiedEmail[][] {
        const chunks: SimplifiedEmail[][] = [];
        for (let i = 0; i < emails.length; i += size) {
            chunks.push(emails.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * Process a micro-batch of emails using Promise.allSettled
     * Each email is processed independently - one failure won't stop others
     */
    private async processChunk(userId: string, emails: SimplifiedEmail[]): Promise<any[]> {
        // Process all emails in parallel using Promise.allSettled
        const results = await Promise.allSettled(
            emails.map(email => this.processSingleEmail(userId, email))
        );

        const transactions: any[] = [];

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const email = emails[i];

            if (result.status === 'fulfilled' && result.value) {
                transactions.push(result.value);
                console.log(`[AI-Based] Success: ${email.messageId}`);
            } else if (result.status === 'rejected') {
                console.log(`[AI-Based] Failed: ${email.messageId} - ${result.reason}`);
            } else {
                console.log(`[AI-Based] Skipped (not a transaction): ${email.messageId}`);
            }
        }

        return transactions;
    }

    /**
     * Process a single email through GPT
     */
    private async processSingleEmail(userId: string, email: SimplifiedEmail): Promise<any | null> {
        const processedEmail = this.preprocessEmail(email);
        const prompt = this.buildSingleEmailPrompt(processedEmail);

        try {
            const response = await this.callModelWithRetry({
                model: GPT_MODEL,
                messages: prompt,
                response_format: { type: 'json_object' }
            });

            const content = response.choices[0].message.content;
            if (!content) {
                console.log(`[AI-Based] Empty response for: ${email.messageId}`);
                return null;
            }

            const parsed: GptTransactionResult = JSON.parse(content);

            // Check if it's a valid transaction
            if (!parsed.isTransaction) {
                return null;
            }

            // Validate required fields
            if (!parsed.amount || !parsed.merchantName) {
                console.log(`[AI-Based] Missing required fields for: ${email.messageId}`);
                return null;
            }

            // Map to transaction format
            return await this.mapResultToTransaction(userId, {
                ...parsed,
                id: email.messageId
            }, email);

        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            console.error(`[AI-Based] Error processing ${email.messageId}:`, errorMsg);
            throw err; // Let Promise.allSettled handle this
        }
    }

    /**
     * Preprocess email to minimal JSON
     */
    private preprocessEmail(email: SimplifiedEmail): ProcessedEmail {
        // Strip HTML-like tags if any exist in 'body' (already partially cleaned in scanner, but safety first)
        let cleanBody = email.body.replace(/<[^>]*>/g, ' ');

        // Remove excessive whitespace
        cleanBody = cleanBody.replace(/\s+/g, ' ').trim();

        // Truncate to avoid huge tokens (keep enough for context)
        // Receipt info is usually at top.
        cleanBody = cleanBody.substring(0, 1000);

        return {
            id: email.messageId,
            subject: email.subject.replace(/\s+/g, ' ').trim(),
            body: cleanBody,
            from: email.from,
            to: email.to || '',
            date: new Date(email.internalDate).toISOString()
        };
    }

    /**
     * Build the prompt
     */
    private buildPrompt(emails: ProcessedEmail[]): any[] {
        const systemPrompt = `You are a deterministic transaction classifier and extractor.
Return clean JSON only.
`;
        const userPrompt = `Given the following ${emails.length} emails, determine for each:

1. Is this a credit card transaction? (true/false)
2. If true, extract:
   - merchantName
   - amount (number)
   - currency (e.g. INR, USD)
   - date (YYYY-MM-DD)
   - cardLast4 (if present)
   - bankName (if present)
   - any other transaction metadata

Return a JSON object with a key "results" containing an array of ${emails.length} objects in the same order as input:
{
  "results": [
    { "id": "...", "isTransaction": true, "merchantName": "...", "amount": 100, ... }
  ]
}

Here are the emails:
${JSON.stringify({ emails })}`;

        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
    }

    /**
     * Build simplified prompt for single email extraction
     * Simpler prompt = fewer hallucinations
     */
    private buildSingleEmailPrompt(email: ProcessedEmail): any[] {
        const systemPrompt = `You are a transaction extractor. Extract transaction details from the email. Return JSON only.`;

        const userPrompt = `Extract transaction details from this email if it's a credit card transaction.

Email:
Subject: ${email.subject}
From: ${email.from}
Date: ${email.date}
Body: ${email.body}

Return ONLY this JSON format:
{
  "isTransaction": true/false,
  "merchantName": "string or null",
  "amount": number or null,
  "currency": "INR/USD/etc or null",
  "date": "YYYY-MM-DD or null",
  "cardLast4": "4 digits or null",
  "bankName": "string or null"
}`;

        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
    }

    /**
     * Call OpenAI with strict retry logic
     */
    private async callModelWithRetry(payload: any): Promise<any> {
        try {
            return await this.callOpenAI(payload);
        } catch (err) {
            if (this.isSystemError(err)) {
                console.warn('[GptProcessor] System error detected, retrying exactly once...', (err as Error).message);
                return await this.callOpenAI(payload);
            }
            throw err;
        }
    }

    private async callOpenAI(payload: any) {
        // Set timeout via AbortController or client options. 
        // OpenAI Node SDK supports `timeout` in request options.
        return await this.openai.chat.completions.create(payload, {
            timeout: TIMEOUT_MS
        });
    }

    private isSystemError(err: any): boolean {
        if (!err) return false;

        // Timeout
        if (err.code === 'ETIMEDOUT' || err.type === 'request_timeout' || err.message?.includes('timeout')) {
            return true;
        }

        // Network
        if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
            return true;
        }

        // 5xx Server Errors
        if (err.status && err.status >= 500 && err.status < 600) {
            return true;
        }

        // 429 - typically Rate Limit, but sometimes treated as "back off and retry". 
        // Spec says "429 only if it's server-side burst throttling". 
        // We'll treat all 429s as retriable for now as per "recoverable system error" bucket usually.
        if (err.status === 429) {
            return true;
        }

        return false;
    }

    private async mapResultToTransaction(userId: string, res: GptTransactionResult, email: SimplifiedEmail) {
        const bankName = res.bankName || 'Unknown Bank';
        const last4 = res.cardLast4 || '0000';
        const cardKey = `${bankName}:${last4}`;

        let card = this.cardCache.get(cardKey);

        // Card Resolution
        if (!card) {
            card = await cardsQueries.findCardByBankAndLastFour(userId, bankName, last4);
            if (!card) {
                // Try create
                try {
                    card = await cardsQueries.createCard({
                        userId,
                        cardName: `${bankName} ${last4}`,
                        bankName,
                        lastFour: last4,
                        billDate: 1, dueDate: 10, creditLimit: 0
                    });
                } catch {
                    // race condition
                    card = await cardsQueries.findCardByBankAndLastFour(userId, bankName, last4);
                }
            }
            if (card) this.cardCache.set(cardKey, card);
        }

        if (!card) return null;

        return {
            cardId: card.id,
            amount: res.amount,
            transactionDate: res.date ? new Date(res.date) : new Date(email.internalDate),
            merchant: res.merchantName || 'Unknown',
            category: 'Uncategorized',
            emailMessageId: email.messageId,
            emailSubject: email.subject,
            currencyCode: res.currency,
            metadata: {
                confidence: res.confidence,
                gptModel: GPT_MODEL,
                originalResponse: res
            }
        };
    }
}

export const gptProcessor = new GptBatchProcessor();
