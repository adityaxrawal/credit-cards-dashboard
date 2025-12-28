import { CleanEmail, ClassificationResult, Instrument } from '../../../types/transaction.types';
import pool from '../../../lib/db';
import logger from '../../../utils/infrastructure/logger';
import OpenAI from 'openai';
import { env } from '../../../config/env';
import pLimit from 'p-limit';
import { BroadFinancialDetector } from '../detection/BroadFinancialDetector';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
});

// Concurrency Limiter for GPT Calls
const CONCURRENCY = parseInt(process.env.GPT_CONCURRENCY || '10', 10);
const limit = pLimit(CONCURRENCY);

const MAX_BATCH_TOKENS = 12000; // ~48k chars. Leaves room for system prompt and output.

interface GPTBatch {
    batchId: string;
    emails: Array<{ messageId: string; email: CleanEmail; }>;
    createdAt: Date;
    resolveCallbacks: Array<(value: ClassificationResult) => void>;
    rejectCallbacks: Array<(reason?: any) => void>;
    estimatedTokens: number;
    userId: string;
    instruments: Instrument[];
}

export class GPTClassifier {
    private static pendingBatch: GPTBatch | null = null;
    private static batchSize = 5; // User requested exact batch size of 5
    private static batchTimeoutMs = 30000; // 30s Safety net (Primary trigger is count or forceFlush)
    private static timeoutHandle: NodeJS.Timeout | null = null;

    private static estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    static async classify(
        userId: string,
        cleanEmail: CleanEmail,
        instruments: Instrument[]
    ): Promise<ClassificationResult> {

        // Calculate tokens for this email
        // Body truncated to 15000 chars in prompt, but we should count full input here or approx
        const bodyTokens = this.estimateTokens(cleanEmail.cleanedBody.substring(0, 15000));
        const overhead = 100; // Headers + JSON overhead
        const emailTokens = bodyTokens + overhead;

        return new Promise((resolve, reject) => {
            // Check if current batch exists
            if (this.pendingBatch) {
                // Check if adding this email would exceed limits
                const willExceedTokens = (this.pendingBatch.estimatedTokens + emailTokens) > MAX_BATCH_TOKENS;
                const willExceedCount = this.pendingBatch.emails.length >= this.batchSize;

                if (willExceedTokens || willExceedCount) {
                    // Flush current batch FIRST
                    this.triggerFlush();
                }
            }

            // Initialize batch if needed (either new or after flush)
            if (!this.pendingBatch) {
                this.pendingBatch = {
                    batchId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    emails: [],
                    createdAt: new Date(),
                    resolveCallbacks: [],
                    rejectCallbacks: [],
                    estimatedTokens: 0,
                    userId,         // Store context
                    instruments     // Store context
                };

                // Set timeout
                this.timeoutHandle = setTimeout(() => {
                    this.triggerFlush();
                }, this.batchTimeoutMs);
            }

            // Add to batch
            this.pendingBatch.emails.push({ messageId: cleanEmail.id, email: cleanEmail });
            this.pendingBatch.resolveCallbacks.push(resolve);
            this.pendingBatch.rejectCallbacks.push(reject);
            this.pendingBatch.estimatedTokens += emailTokens;

            // Check IMMEDIATE flush condition (Strictly on size 5)
            if (this.pendingBatch.estimatedTokens >= MAX_BATCH_TOKENS || this.pendingBatch.emails.length >= this.batchSize) {
                if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
                this.triggerFlush();
            }
        });
    }

    // Public method to force flush remaining items (e.g. at end of job)
    public static forceFlush() {
        if (this.pendingBatch) {
            logger.info(`[GPT] Forcing flush of pending batch (Size: ${this.pendingBatch.emails.length})`);
            this.triggerFlush();
        }
    }

    private static triggerFlush() {
        if (!this.pendingBatch) return;
        const batchToProcess = this.pendingBatch;

        // Reset immediately
        this.pendingBatch = null;
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = null;
        }

        // Execute with concurrency limit
        limit(() => this.processBatch(batchToProcess)).catch(err => {
            logger.error('Failed to process batch via limit', err);
        });
    }

    private static async processBatch(batch: GPTBatch): Promise<void> {
        if (!batch.emails.length) return;

        try {
            logger.info(`Processing GPT batch of ${batch.emails.length} emails (Concurrency: Active ${limit.activeCount}/5)`);

            // 1. Prepare Prompt
            // Increased context window to 15000 chars
            const emailTexts = batch.emails
                .map((e, i) => `Email ${i + 1} (ID: ${e.messageId}):\nSubject: ${e.email.subject}\nFrom: ${e.email.from}\nBody: ${e.email.cleanedBody.substring(0, 15000)}`)
                .join('\n---\n');

            const systemPrompt = `You are a precision financial auditor. Your task is to extract ONE transaction event from the email text.

CRITICAL INSTRUCTION:
Return a result for EVERY message ID provided. Do not skip any.

OBJECTIVE:
Identify ALL valid financial transactions where money has successfully moved.
A transaction is any event where money is spent, received, or moved.
Keywords: "spent", "debited", "charged", "paid", "sent", "received", "credited", "refunded", "withdrawal", "purchase", "invested", "redeemed".

CLASSIFICATION RULES:
1. **Valid Transaction**: Confirmed debit/credit. "Your acct XX123 is debited for INR 500".
2. **Bill Generated (Pending)**: "Your bill of INR 500 is generated", "Due date...", "Statement for...". Money hasn't moved yet. Classify as "bill_due".
3. **Marketing/Offer**: "Get INR 500 cashback", "Loan offer", "Use voucher", "Upgrade now". Classify as "marketing_brand_promo".
4. **Non-Financial**: Newsletters, daily digests, market updates, login alerts.
5. **Merchant Receipts**: "We have received your payment" (from Insurance, Netlfix, etc.). IGNORE these. Only extract if it is a BANK alert saying "Debited for...".

SPECIFIC GUIDELINES:
1. IGNORE "Available Balance", "Credit Limit", or "Outstanding Due" ALONE. Only extract if there is also a SPEND/CREDIT event.
2. IGNORE OTPs (One Time Password) or Login Alerts. Mark "is_transaction": false.
3. IGNORE Merchant/Service Provider Acknowledgments. We only want the source-of-truth transaction from the Bank/Card.
4. If the email contains multiple transactions (e.g. a statement summary), extract the MOST RECENT or LARGEST one.
5. Merchant Name: Extract the CLEAN merchant name (e.g. "Uber" instead of "Uber India Tech Pvt Ltd"). REMOVE location/city if possible.
6. Amount: Extract pure number. IGNORE commas if necessary but preserve decimals.
7. Currency: Standardize to INR, USD, etc.
8. Date: Extract date if available.

GUARDRAILS:
- Do NOT mark "is_transaction": false if there is a clear amount and words like "debited" or "credited".
- Use "unclassified" if you are unsure of the type but it looks financial.
`;

            const userPrompt = `Classify these ${batch.emails.length} emails:\n\n${emailTexts}`;

            console.log(`[GPT] Sending batch request (Size: ${batch.emails.length})`);
            const startStr = Date.now();

            // Schema Definition for Structured Output
            const extractionSchema = {
                name: "transaction_extraction",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        results: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    messageId: { type: "string" },
                                    is_transaction: { type: "boolean" },
                                    reasoning: { type: "string" },
                                    type: {
                                        type: "string",
                                        enum: ["cc_spend", "cc_payment", "cc_upi", "bank_debit", "bank_credit", "bank_upi_debit", "bank_upi_credit", "refund", "investment", "travel", "food", "transport", "bill_due", "marketing_brand_promo", "unclassified", "non_financial"]
                                    },
                                    confidence: { type: "number" },
                                    extracted: {
                                        type: "object",
                                        properties: {
                                            merchant: { type: ["string", "null"] },
                                            amount: { type: ["number", "null"] },
                                            currency: { type: ["string", "null"] },
                                            date: { type: ["string", "null"] }
                                        },
                                        required: ["merchant", "amount", "currency", "date"],
                                        additionalProperties: false
                                    }
                                },
                                required: ["messageId", "is_transaction", "reasoning", "type", "confidence", "extracted"],
                                additionalProperties: false
                            }
                        }
                    },
                    required: ["results"],
                    additionalProperties: false
                }
            };

            // 2. Call OpenAI with Structured Outputs
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.1,
                response_format: {
                    type: 'json_schema',
                    json_schema: extractionSchema
                },
            });

            const content = response.choices[0].message.content;
            if (!content) throw new Error('Empty GPT response');

            let parsed: any;
            try {
                parsed = JSON.parse(content);
            } catch (jsonError) {
                logger.error('[GPT] JSON Parse Error:', { content });
                throw new Error('Malformed JSON response from GPT');
            }

            const results = parsed.results as Array<{ messageId: string; is_transaction: boolean; type: any; confidence: number; extracted: any; reasoning?: string }>;

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
                        // === HANDLE SPECIAL TYPES ===
                        // If GPT identifies it as "bill_due" or "marketing", we treat it as non_financial for now
                        if (result.type === 'bill_due' || result.type === 'marketing_brand_promo') {
                            result.is_transaction = false;
                            result.type = 'non_financial';
                        }

                        // === GUARDRAILS === 
                        // Guard against false "Non-Financial" negatives
                        if (result.is_transaction === false || result.type === 'non_financial') {
                            // Check with BroadDetector
                            const detection = BroadFinancialDetector.detect(req.email.subject + ' ' + req.email.cleanedBody);

                            // If Rule-based detector is VERY confident (>70) that it IS financial, 
                            // we override GPT's negative decision to force manual review.
                            // BUT: If the reasoning contains "bill" or "marketing", we trust GPT even if BroadDetector liked it.
                            if (detection.isFinancial && detection.score >= 70) {
                                const reasoningLower = (result.reasoning || '').toLowerCase();
                                if (reasoningLower.includes('bill') || reasoningLower.includes('startement') || reasoningLower.includes('promo') || reasoningLower.includes('offer')) {
                                    // Trust GPT that it's just a bill/promo
                                } else {
                                    logger.info(`[GPT] Guardrail Triggered: GPT said non-financial, but BroadDetector score is ${detection.score}. Marking for review.`);
                                    batch.resolveCallbacks[index]({
                                        type: 'unclassified' as any,
                                        confidence: 0.5, // Low confidence to trigger review
                                        metadata: {
                                            reason: `GPT said non-financial but BroadDetector detected: ${detection.reasons.join(', ')}`,
                                            original_gpt_reason: result.reasoning
                                        }
                                    });
                                    return;
                                }
                            }

                            batch.resolveCallbacks[index]({
                                type: 'non_financial' as any,
                                confidence: result.confidence || 0.9,
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
