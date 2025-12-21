import { CleanEmail, ClassificationResult, Instrument } from '../../types/transaction.types';
import pool from '../../lib/db';
import logger from '../../utils/infrastructure/logger';
import OpenAI from 'openai';
import { env } from '../../config/env';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
});

interface GPTBatch {
    batchId: string;
    emails: Array<{ messageId: string; email: CleanEmail; }>;
    createdAt: Date;
    resolveCallbacks: Array<(value: ClassificationResult) => void>;
    rejectCallbacks: Array<(reason?: any) => void>;
}

export class GPTClassifier {
    private static pendingBatch: GPTBatch | null = null;
    private static batchSize = 50;
    private static batchTimeoutMs = 5000;
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
                    this.flushBatch(userId, instruments).catch(err => {
                        logger.error('Failed to flush batch on timeout', err);
                    });
                }, this.batchTimeoutMs);
            }

            // Add to batch
            this.pendingBatch.emails.push({ messageId: cleanEmail.id, email: cleanEmail });
            this.pendingBatch.resolveCallbacks.push(resolve);
            this.pendingBatch.rejectCallbacks.push(reject);

            // If full, process immediately
            if (this.pendingBatch.emails.length >= this.batchSize) {
                if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
                this.flushBatch(userId, instruments).catch(err => {
                    logger.error('Failed to flush full batch', err);
                });
            }
        });
    }

    private static async flushBatch(userId: string, instruments: Instrument[]): Promise<void> {
        if (!this.pendingBatch || this.pendingBatch.emails.length === 0) return;

        const batch = this.pendingBatch;
        this.pendingBatch = null; // Reset immediately so new requests form new batch
        this.timeoutHandle = null;

        try {
            logger.info(`Processing GPT batch of ${batch.emails.length} emails`);

            // 1. Prepare Prompt
            const emailTexts = batch.emails
                .map((e, i) => `Email ${i + 1} (ID: ${e.messageId}):\nSubject: ${e.email.subject}\nFrom: ${e.email.from}\nBody: ${e.email.cleanedBody.substring(0, 1000)}`) // Truncate body
                .join('\n---\n');

            const systemPrompt = `You are a financial transaction classifier. For each email, determine:
1. Transaction type (strictly one of: cc_spend, cc_upi, bank_credit, bank_debit, bank_upi_debit, bank_upi_credit, salary, refund, chargeback, statement_txn, unclassified). 
   - Use 'unclassified' ONLY if the email is financial but does not fit any other type. 
   - For non-financial emails, if they reached here, still try to find the closest financial type or use 'unclassified'.
   - Do not invent new types like 'cc_debit'.
2. Confidence (0-1 scale)
3. Extracted fields (amount, merchant, date, etc.). Merchant should be the actual vendor name, not phrases like "help you" or "thank you".

Context:
User Instruments: ${JSON.stringify(instruments.map(i => ({ type: i.instrument_type, bank: i.bank_name, last4: i.account_number_masked })))}

Return a JSON object with a key "results" which is an array of objects corresponding to the emails in order.
Each result object must have:
- messageId (from input)
- type
- confidence
- extracted (object with amount, merchant, etc.)
`;

            const userPrompt = `Classify these ${batch.emails.length} emails:\n\n${emailTexts}`;

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

            const parsed = JSON.parse(content);
            const results = parsed.results as Array<{ messageId: string; type: any; confidence: number; extracted: any }>;

            // 3. Store Batch Log
            await pool.query(
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

            // 4. Resolve Promises
            // Map back results to promises by messageId or index
            // Since order is preserved, we can use index, but messageId is safer if GPT skipped one (which it shouldn't)
            // We'll rely on index for simplicity but check messageId if possible.

            batch.emails.forEach((req, index) => {
                const result = results.find(r => r.messageId === req.messageId) || results[index];

                if (result) {
                    // Type Normalization (Fixing hallucinations)
                    let normalizedType = result.type;
                    if (normalizedType === 'cc_debit') normalizedType = 'cc_spend';
                    if (normalizedType === 'bank_transfer') normalizedType = 'bank_debit';

                    batch.resolveCallbacks[index]({
                        type: normalizedType,
                        confidence: result.confidence,
                        metadata: result.extracted
                    });
                } else {
                    batch.rejectCallbacks[index](new Error('GPT did not return a result for this email'));
                }
            });

        } catch (error) {
            logger.error('GPT batch processing failed', error);
            // Fail all
            batch.rejectCallbacks.forEach(reject => reject(error));
        }
    }
}
