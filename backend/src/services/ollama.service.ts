import { PromptFactory } from '../lib/promptFactory';
import { safeParseMLOutput, MLClassificationResult } from '../types/ml-schema';
import * as crypto from 'crypto';

/**
 * Ollama Service - Sequential Single-Email Processing
 * 
 * Strategy:
 * 1. Sequential processing (no concurrency control)
 * 2. Single attempt per email (no automatic retries)
 * 3. 60-second timeout for reasoning models
 * 4. In-memory SHA256 caching for deduplication
 * 5. Enhanced logging for request/response lifecycle
 */
export class OllamaService {
    private static baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    private static model = process.env.OLLAMA_MODEL || 'deepseek-r1:8b';
    private static timeoutMs = 60000; // Increased to 60s for DeepSeek-R1 reasoning (8b/32b models)

    // In-memory Deduplication Cache
    private static resultCache = new Map<string, { result: MLClassificationResult, timestamp: number }>();
    private static CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

    // Performance metrics
    private static metrics = {
        totalCalls: 0,
        totalLatencyMs: 0,
        cacheHits: 0,
        errors: 0,
    };

    /**
     * Get performance metrics
     */
    static getMetrics() {
        const avgLatency = this.metrics.totalCalls > 0
            ? this.metrics.totalLatencyMs / this.metrics.totalCalls
            : 0;
        return {
            totalCalls: this.metrics.totalCalls,
            avgLatencyMs: Math.round(avgLatency),
            cacheHits: this.metrics.cacheHits,
            model: this.model,
            errors: this.metrics.errors,
        };
    }



    /**
     * Health check and Background Warmup
     */
    static async healthCheck(): Promise<boolean> {
        try {
            this.log('[Ollama] Performing health check...', false);
            const startTime = Date.now();

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check

            const response = await fetch(`${this.baseUrl}/api/tags`, { signal: controller.signal });
            clearTimeout(timeoutId);

            const elapsed = Date.now() - startTime;

            if (!response.ok) {
                this.log(`[Ollama] Health check failed: HTTP ${response.status}`, true);
                return false;
            }

            const data = await response.json();
            const hasModels = data.models && data.models.length > 0;

            this.log(
                `[Ollama] Health check passed in ${elapsed}ms. Models available: ${data.models?.length || 0}`,
                false
            );

            if (!hasModels) {
                this.log('[Ollama] WARNING: No models installed in Ollama!', true);
                return false;
            }

            // Trigger background warmup
            this.warmup().catch(e => console.error('[Ollama] Warmup error', e));
            return true;
        } catch (error) {
            this.log(
                `[Ollama] Health check failed: ${(error as Error).message}`,
                true
            );
            return false;
        }
    }

    /**
     * Keep model loaded without processing
     * Note: Warmup may return empty response, that's OK - we just want to load the model
     */
    static async warmup(): Promise<boolean> {
        try {
            this.log(`[Ollama] Starting warmup for model: ${this.model}`, false);

            const testPrompt = 'ping'; // Simple prompt just to load model
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000); // 10 sec is enough for warmup

            const startTime = Date.now();

            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt: testPrompt,
                    stream: false,
                    keep_alive: -1,
                    options: {
                        temperature: 0,
                        num_predict: 1, // Minimal for warmup
                        num_ctx: 4096
                    }
                })
            });

            clearTimeout(timeout);
            const elapsed = Date.now() - startTime;

            if (!response.ok) {
                this.log(
                    `[Ollama] Warmup failed: HTTP ${response.status}`,
                    true
                );
                return false;
            }

            const data = await response.json();

            // Success if we got a response from Ollama, even if empty
            // Warmup just needs to load the model into memory
            this.log(
                `[Ollama] Model ${this.model} warmed successfully in ${elapsed}ms`,
                false
            );

            return true;

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                this.log(
                    `[Ollama] Warmup timeout: Model took > 10 seconds to load.`,
                    true
                );
            } else {
                this.log(
                    `[Ollama] Warmup failed: ${(error as Error).message}`,
                    true
                );
            }

            return false;
        }
    }

    /**
     * Helper to log with timestamp
     */
    private static log(message: string, isError = false) {
        const timestamp = new Date().toISOString();
        const logMsg = `[${timestamp}] ${message}`;
        if (isError) console.error(logMsg);
        else console.log(logMsg);
    }

    /**
     * Classify email (Sequential Processing - No Retries)
     * Single attempt per email with enhanced logging
     */
    static async classifyEmail(emailText: string, metadata: { messageId?: string, subject?: string } = {}): Promise<MLClassificationResult> {
        const { messageId = 'unknown', subject = 'unknown' } = metadata;

        // 1. Cache Check
        const cacheKey = this.hashInput(emailText);
        const cached = this.resultCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL_MS)) {
            this.metrics.cacheHits++;
            return cached.result;
        }

        // 2. Direct Sequential Processing (single attempt)
        const startTime = Date.now();
        this.log(`[Ollama] Processing email: ${messageId} | Subject: "${subject.substring(0, 50)}..."`);

        try {
            // Generate prompt
            const prompt = PromptFactory.generateClassificationPrompt(emailText);

            // Single Ollama call (no retry)
            const responseText = await this.callOllamaFast(prompt, messageId);

            // Parse response
            const result = this.parseResponse(responseText, messageId);

            // Update Cache
            this.resultCache.set(cacheKey, { result, timestamp: Date.now() });

            // Metrics
            const latency = Date.now() - startTime;
            this.metrics.totalCalls++;
            this.metrics.totalLatencyMs += latency;

            // LOG: After inference
            this.log(`[Ollama] Email ${messageId} | isTransaction=${result.isTransaction} | merchant="${result.merchant}" | confidence=${result.confidence} | Latency=${latency}ms`);

            return result;

        } catch (error: any) {
            this.metrics.errors++;
            const latency = Date.now() - startTime;
            // LOG: Inference Failed (no retry)
            this.log(`[Ollama] ERROR inference failed for email ${messageId} after ${latency}ms: ${error.message}`, true);
            return this.getDefaultResponse();
        }
    }


    /**
     * Low-latency HTTP call with enhanced logging
     */
    private static async callOllamaFast(prompt: string, messageId: string): Promise<string> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
        const startTime = Date.now();

        try {
            this.log(
                `[Ollama] Sending request for ${messageId}: prompt=${prompt.length} chars, timeout=${this.timeoutMs}ms`,
                false
            );

            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Connection': 'keep-alive'
                },
                body: JSON.stringify({
                    model: this.model,
                    prompt: prompt,
                    stream: false,
                    keep_alive: -1,
                    options: {
                        temperature: 0,
                        num_predict: 1500, // CRITICAL: DeepSeek-R1 needs 800-1200 tokens for reasoning + JSON
                        num_ctx: 4096, // Sufficient context window
                        top_p: 1.0,
                        stop: ['}\n'] // Stop cleanly after JSON closing brace
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const elapsed = Date.now() - startTime;

            this.log(
                `[Ollama] Response received for ${messageId} in ${elapsed}ms, status=${response.status}`,
                false
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} from Ollama`);
            }

            const data = await response.json();

            // CRITICAL FIX: DeepSeek-R1 returns BOTH 'thinking' and 'response' fields
            // Combine both to get the full output including <think> reasoning + JSON
            const thinking = (data.thinking || '').trim();
            const answer = (data.response || '').trim();

            let responseText = '';
            // If both exist, wrap thinking in tags and combine
            if (thinking && answer) {
                responseText = `<think>${thinking}</think>\n\n${answer}`;
            } else {
                // Fallback: return whichever is available
                responseText = thinking || answer || data.response || '';
            }

            this.log(
                `[Ollama] Response body for ${messageId}: ${responseText.length} chars, eval_count=${data.eval_count || 0}`,
                false
            );

            return responseText;

        } catch (error) {
            clearTimeout(timeoutId);
            const elapsed = Date.now() - startTime;

            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    this.log(
                        `[Ollama] Request ABORTED after ${elapsed}ms for ${messageId} (timeout=${this.timeoutMs}ms). Model too slow or overloaded.`,
                        true
                    );
                    throw new Error(`Request timed out after ${this.timeoutMs}ms`);
                } else {
                    this.log(
                        `[Ollama] Fetch error for ${messageId} after ${elapsed}ms: ${error.message}`,
                        true
                    );
                }
            }

            throw error;
        }
    }

    private static parseResponse(text: string, messageId: string, latencyMs?: number): MLClassificationResult {
        try {
            // CRITICAL: Check for empty response (primary root cause)
            if (!text || text.length === 0) {
                const error = 'Empty response from Ollama. Check: model installed, num_predict value, timeout settings.';
                this.log(
                    `[Ollama] CRITICAL ${error} for ${messageId}${latencyMs ? ` (latency=${latencyMs}ms)` : ''}`,
                    true
                );
                throw new Error(error);
            }

            this.log(
                `[Ollama] Parsing response for ${messageId} (${text.length} chars)${latencyMs ? `, latency=${latencyMs}ms` : ''}`,
                false
            );

            // CRITICAL: Remove <think>...</think> tags (DeepSeek-R1 reasoning blocks)
            let cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

            // Verify we still have content after stripping reasoning
            if (cleanText.length === 0) {
                const error = 'Response only contained thinking tags, no JSON output.';
                this.log(`[Ollama] ERROR ${error} for ${messageId}`, true);
                throw new Error(error);
            }

            // Robust JSON extraction
            const jsonStart = cleanText.indexOf('{');
            const jsonEnd = cleanText.lastIndexOf('}');
            if (jsonStart === -1 || jsonEnd === -1) {
                throw new Error('No JSON brackets found in response after <think> removal');
            }

            const jsonStr = cleanText.substring(jsonStart, jsonEnd + 1);
            const parsed = JSON.parse(jsonStr);

            // Validate against schema
            const result = safeParseMLOutput(parsed);
            if (result.success) {
                const finalResult = result.data;
                this.log(
                    `[Ollama] SUCCESS for ${messageId}: isTransaction=${finalResult.isTransaction}, merchant=${finalResult.merchant}, confidence=${finalResult.confidence}${latencyMs ? `, latency=${latencyMs}ms` : ''}`,
                    false
                );
                return finalResult;
            }

            // Schema validation failed
            this.log(`[Ollama] Schema validation failed for ${messageId}. Parsed JSON: ${JSON.stringify(parsed)}`, true);

            // Return default with error details
            return {
                ...this.getDefaultResponse(),
                error: 'Schema validation failed',
                rawResponse: text.substring(0, 500)
            };
        } catch (e) {
            const errorMsg = (e as Error).message;
            const rawSnippet = text ? text.substring(0, 200) : '';

            this.log(
                `[Ollama] Parse error for ${messageId}: ${errorMsg}. Raw: ${rawSnippet}...${latencyMs ? `, latency=${latencyMs}ms` : ''}`,
                true
            );

            // Return default with full error context
            return {
                ...this.getDefaultResponse(),
                error: errorMsg,
                rawResponse: rawSnippet
            };
        }
    }

    private static hashInput(text: string): string {
        return crypto.createHash('sha256').update(text).digest('hex');
    }

    static getDefaultResponse(): MLClassificationResult {
        return {
            isTransaction: false,
            category: 'non_transaction',
            merchant: null,
            amount: null,
            currency: null,
            transactionDate: null,
            cardLast4: null,
            confidence: 0
        };
    }
}
