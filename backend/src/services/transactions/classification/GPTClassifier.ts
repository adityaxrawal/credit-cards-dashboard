import { CleanEmail, ClassificationResult, Instrument } from '../../../types/transaction.types';
import pool from '../../../lib/db';
import logger from '../../../utils/infrastructure/logger';
import OpenAI from 'openai';
import { env } from '../../../config/env';
import pLimit from 'p-limit';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
});

// Concurrency Limiter for GPT Calls
const limit = pLimit(5);

interface GPTBatch {
    batchId: string;
    emails: Array<{ messageId: string; email: CleanEmail; }>;
    createdAt: Date;
    resolveCallbacks: Array<(value: ClassificationResult) => void>;
    rejectCallbacks: Array<(reason?: any) => void>;
}

export class GPTClassifier {
    private static pendingBatch: GPTBatch | null = null;
    private static batchSize = env.BATCH_SIZE;
    private static batchTimeoutMs = 2000; // Reduced timeout for faster processing of small batches
    private static timeoutHandle: NodeJS.Timeout | null = null;

    static async classify(
        userId: string,
        cleanEmail: CleanEmail,
        instruments: Instrument[]
    ): Promise<ClassificationResult> {

        return new Promise((resolve, reject) => {
            // Initialize batch if needed
            if (!this.pendingBatch) {
                this.pendingBatch = {
                    batchId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    emails: [],
                    createdAt: new Date(),
                    resolveCallbacks: [],
                    rejectCallbacks: []
                };

                // Set timeout to process even if not full
                this.timeoutHandle = setTimeout(() => {
                    this.triggerFlush(userId, instruments);
                }, this.batchTimeoutMs);
            }

            // Add to batch
            this.pendingBatch.emails.push({ messageId: cleanEmail.id, email: cleanEmail });
            this.pendingBatch.resolveCallbacks.push(resolve);
            this.pendingBatch.rejectCallbacks.push(reject);

            // If full, process immediately
            if (this.pendingBatch.emails.length >= this.batchSize) {
                if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
                this.triggerFlush(userId, instruments);
            }
        });
    }

    private static triggerFlush(userId: string, instruments: Instrument[]) {
        if (!this.pendingBatch) return;
        const batchToProcess = this.pendingBatch;
        this.pendingBatch = null; // Reset immediately
        this.timeoutHandle = null;

        // Execute with concurrency limit
        limit(() => this.processBatch(userId, instruments, batchToProcess)).catch(err => {
            logger.error('Failed to process batch via limit', err);
        });
    }

    private static async processBatch(userId: string, instruments: Instrument[], batch: GPTBatch): Promise<void> {
        if (!batch.emails.length) return;

        try {
            logger.info(`Processing GPT batch of ${batch.emails.length} emails (Concurrency: Active ${limit.activeCount}/5)`);

            // 1. Prepare Prompt
            const emailTexts = batch.emails
                .map((e, i) => `Email ${i + 1} (ID: ${e.messageId}):\nSubject: ${e.email.subject}\nFrom: ${e.email.from}\nBody: ${e.email.cleanedBody.substring(0, 1500)}`) // Truncate body
                .join('\n---\n');

            const systemPrompt = `You are a precision financial auditor. Your task is to extract ONE transaction event from the email text.

CRITICAL INSTRUCTION:
Return a result for EVERY message ID provided. Do not skip any. If you cannot classify an email, return "type": "unclassified".

OBJECTIVE:
Identify ALL valid financial transactions. It is better to classify something as "unclassified" than to miss a valid transaction.
A transaction is any event where money is spent, received, or moved.
Keywords to look for: "spent", "debited", "charged", "paid", "sent", "received", "credited", "refunded", "withdrawal", "purchase".

CRITICAL RULES:
1. IGNORE "Available Balance", "Credit Limit", or "Outstanding Due". These are NOT the transaction amount.
2. IGNORE OTPs, Login Alerts, or Marketing. Return "is_transaction": false.
3. If the email contains multiple transactions (e.g. a statement), extract the most recent one only.
4. Merchant Name: Extract the CLEAN merchant name (e.g., "Uber" instead of "Uber India Tech Pvt Ltd").
5. Amount: Must be a number. Ignore commas.

REASONING GUIDELINES:
- If "is_transaction" is false, you MUST explain WHY.
- If "is_transaction" is true, explain what specific text confirmed the transaction.
- If unsure, mark as "unclassified" and explain the ambiguity.

OUTPUT FORMAT (JSON):
For each email, return an object in the "results" array:
{
  "messageId": "string",
  "is_transaction": boolean,
  "reasoning": "string", // rigorous Chain of Thought
  "type": "string", // One of: cc_spend, cc_payment, cc_upi, bank_debit, bank_credit, bank_upi_debit, bank_upi_credit, refund, unclassified
  "confidence": number, // 0-1
  "extracted": {
    "merchant": "string",
    "amount": number,
    "currency": "INR", // or USD
    "date": "YYYY-MM-DD"
  }
}
`;

            const userPrompt = `Classify these ${batch.emails.length} emails:\n\n${emailTexts}`;

            console.log(`[GPT] Sending batch request (Size: ${batch.emails.length})`);
            const startStr = Date.now();

            // 2. Call OpenAI
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini', // Cost effective
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.1,
                response_format: { type: 'json_object' },
            });

            const content = response.choices[0].message.content;
            if (!content) throw new Error('Empty GPT response');

            let parsed: any;
            try {
                // Strip markdown code blocks if present
                const cleanContent = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                parsed = JSON.parse(cleanContent);
            } catch (jsonError) {
                logger.error('[GPT] JSON Parse Error:', { content });
                throw new Error('Malformed JSON response from GPT');
            }

            let results = parsed.results as Array<{ messageId: string; is_transaction: boolean; type: any; confidence: number; extracted: any; reasoning?: string }>;

            // Handle case where GPT returns a single object instead of an array (common in small batches)
            if (!results && parsed.messageId && typeof parsed.is_transaction === 'boolean') {
                logger.warn('[GPT] GPT returned single object instead of array. Adapting...', { messageId: parsed.messageId });
                results = [parsed]; // Treat as single result array
            }

            // Handle case where GPT returns array directly without { results: ... } wrapper
            if (!results && Array.isArray(parsed)) {
                logger.warn('[GPT] GPT returned array directly. Adapting...');
                results = parsed;
            }

            // Validate results array
            if (!Array.isArray(results)) {
                logger.error('[GPT] Invalid results format (expected array or {results: array}):', { parsed });
                throw new Error('GPT response missing results array');
            }

            console.log(`[GPT] Batch processed in ${Date.now() - startStr}ms`);

            // 3. Store Batch Log (Fire and forget)
            pool.query(
                `INSERT INTO gpt_batch_requests 
         (batch_id, queue_id, email_message_ids, batch_size, status, 
          response_payload, prompt_tokens, completion_tokens, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                [
                    batch.batchId,
                    null, // queue_id
                    JSON.stringify(batch.emails.map(e => e.messageId)),
                    batch.emails.length,
                    'completed',
                    JSON.stringify(parsed),
                    response.usage?.prompt_tokens || 0,
                    response.usage?.completion_tokens || 0,
                ]
            ).catch(e => logger.warn('Failed to log GPT batch', e));

            // 4. Resolve Promises Safely
            batch.emails.forEach((req, index) => {
                try {
                    // Try to find by messageId, fallback to index
                    const result = results.find(r => r.messageId === req.messageId) || results[index];

                    if (result) {
                        // Check if GPT thinks it's a transaction
                        if (result.is_transaction === false) {
                            batch.resolveCallbacks[index]({
                                type: 'non_financial' as any,
                                confidence: result.confidence || 0.9, // High confidence that it is NOT a transaction
                                metadata: { reason: result.reasoning }
                            });
                            return;
                        }

                        // Type Normalization (Fixing hallucinations)
                        let normalizedType = result.type;
                        if (normalizedType === 'cc_debit') normalizedType = 'cc_spend';
                        // Do NOT normalize cc_payment
                        if (normalizedType === 'bank_transfer') normalizedType = 'bank_debit';

                        batch.resolveCallbacks[index]({
                            type: normalizedType,
                            confidence: result.confidence,
                            metadata: result.extracted
                        });
                    } else {
                        logger.warn(`[GPT] No result found for email ${req.messageId} in batch`);
                        batch.rejectCallbacks[index](new Error('GPT did not return a result for this email'));
                    }
                } catch (resError) {
                    logger.error(`[GPT] Error processing result for email ${req.messageId}`, resError);
                    batch.rejectCallbacks[index](resError);
                }
            });

        } catch (error) {
            logger.error('GPT batch processing failed', error);
            // Fail all with specific error
            batch.rejectCallbacks.forEach(reject => reject(error));
        }
    }
}
