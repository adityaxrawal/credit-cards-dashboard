import { PromptFactory } from '../lib/promptFactory';
import { safeParseMLOutput, MLClassificationResult } from '../types/ml-schema';

/**
 * Ollama Service
 * 
 * Handles all interactions with Ollama for ML-based email classification.
 * Includes health checks, retries, timeouts, and strict JSON validation.
 */
export class OllamaService {
    private static baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    // Use llama3.2:3b by default - it's faster and outputs direct JSON
    private static model = process.env.OLLAMA_MODEL || 'llama3.2:3b';
    private static maxRetries = parseInt(process.env.OLLAMA_MAX_RETRIES || '3', 10);
    private static timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '60000', 10);

    /**
     * Health check: Verify Ollama is running and model is loaded
     */
    static async healthCheck(): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${this.baseUrl}/api/tags`, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.error('[Ollama] Health check failed:', response.status, response.statusText);
                return false;
            }

            const data = await response.json();
            const models = data.models || [];
            const modelExists = models.some((m: any) => m.name === this.model);

            if (!modelExists) {
                console.error(`[Ollama] Model ${this.model} not found. Available models:`, models.map((m: any) => m.name));
                return false;
            }

            console.log('[Ollama] Health check passed. Model available:', this.model);
            return true;
        } catch (error) {
            console.error('[Ollama] Health check error:', error);
            return false;
        }
    }

    /**
     * Warm up the model (ensures it's loaded in memory)
     */
    static async warmup(): Promise<void> {
        try {
            console.log('[Ollama] Warming up model:', this.model);
            await this.classifyEmail('Test email for warmup');
            console.log('[Ollama] Model warmed up successfully');
        } catch (error) {
            console.warn('[Ollama] Warmup failed (model may take longer on first real request):', error);
        }
    }

    /**
     * Classify email using ML model
     */
    static async classifyEmail(emailText: string): Promise<MLClassificationResult> {
        const requestId = this.generateRequestId();
        const startTime = Date.now();

        console.log(`[Ollama] [${requestId}] Starting classification`);

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const result = await this.attemptClassification(emailText, requestId, attempt);
                const latency = Date.now() - startTime;
                console.log(`[Ollama] [${requestId}] Success on attempt ${attempt}. Latency: ${latency}ms`);
                return result;
            } catch (error) {
                const isLastAttempt = attempt === this.maxRetries;
                if (isLastAttempt) {
                    const latency = Date.now() - startTime;
                    console.error(`[Ollama] [${requestId}] All ${this.maxRetries} attempts failed. Total time: ${latency}ms`);
                    throw error;
                }
                const backoffMs = Math.pow(2, attempt - 1) * 1000;
                console.warn(`[Ollama] [${requestId}] Attempt ${attempt} failed, retrying in ${backoffMs}ms:`, error);
                await this.sleep(backoffMs);
            }
        }
        throw new Error('Classification failed after all retries');
    }

    /**
     * Classify a batch of emails (Prompt Packing)
     * Falls back to individual processing on failure
     */
    static async classifyBatch(emails: string[]): Promise<MLClassificationResult[]> {
        if (emails.length === 0) return [];
        if (emails.length === 1) return [await this.classifyEmail(emails[0])];

        const requestId = this.generateRequestId();
        console.log(`[Ollama] [${requestId}] Starting BATCH classification for ${emails.length} emails`);

        try {
            const prompt = PromptFactory.generateBatchClassificationPrompt(emails);
            const response = await this.callOllamaWithPrompt(prompt, requestId, true);

            // Extract and parse JSON Array
            const jsonText = this.extractJSON(response);
            if (!jsonText) throw new Error('No JSON found in batch response');

            let parsed: any[];
            try {
                parsed = JSON.parse(jsonText);
            } catch (e) {
                if (jsonText.trim().startsWith('{')) {
                    parsed = JSON.parse(`[${jsonText}]`);
                } else {
                    throw e;
                }
            }

            if (!Array.isArray(parsed)) {
                throw new Error('Response is not a JSON Array');
            }

            // Map results back to order
            const results: MLClassificationResult[] = emails.map((_, index) => {
                const item = parsed.find(p => p.emailIndex === index + 1) || parsed[index];

                if (!item) {
                    return this.getDefaultResponse();
                }

                const valid = safeParseMLOutput(item);
                if (valid.success) return valid.data;

                return this.getDefaultResponse();
            });

            console.log(`[Ollama] [${requestId}] Batch success. Processed ${results.length} items.`);
            return results;

        } catch (error) {
            console.error(`[Ollama] [${requestId}] Batch failed. Falling back to individual processing. Error:`, error);

            // FALLBACK: Run sequentially
            const results: MLClassificationResult[] = [];
            for (const email of emails) {
                try {
                    results.push(await this.classifyEmail(email));
                } catch (e) {
                    results.push(this.getDefaultResponse());
                }
            }
            return results;
        }
    }

    /**
     * Unified Ollama API call
     */
    private static async callOllamaWithPrompt(prompt: string, requestId: string, isBatch = false): Promise<string> {
        const controller = new AbortController();
        // Give more time for batch requests
        const timeout = isBatch ? this.timeoutMs * 2 : this.timeoutMs;
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0,
                        num_predict: isBatch ? 2048 : 256, // More tokens for batch
                    }
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }

            const data = await response.json();
            let text = data.response || '';
            if (!text && data.thinking) text = data.thinking;
            return text;

        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Single attempt at classification
     */
    private static async attemptClassification(
        emailText: string,
        requestId: string,
        attempt: number
    ): Promise<MLClassificationResult> {
        const prompt = PromptFactory.generateClassificationPrompt(emailText);
        const rawResponse = await this.callOllamaWithPrompt(prompt, requestId);

        const logText = rawResponse.substring(0, 200).replace(/\n/g, '\\n');
        console.log(`[Ollama] [${requestId}] Raw output:`, logText);

        if (!rawResponse) {
            throw new Error('Empty response from Ollama');
        }

        const jsonText = this.extractJSON(rawResponse);

        if (!jsonText) {
            console.error(`[Ollama] [${requestId}] No JSON found`);
            throw new Error('No valid JSON found in ML response');
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(jsonText);
        } catch (parseError) {
            console.error(`[Ollama] [${requestId}] JSON parse error. Text was: ${jsonText}`);
            throw new Error(`JSON parse error: ${parseError}`);
        }

        const result = safeParseMLOutput(parsed);

        if (!result.success) {
            const errorMsg = result.error ? result.error.message : 'Unknown validation error';
            console.error(`[Ollama] [${requestId}] Schema validation failed:`, result.error);
            throw new Error(`Schema validation failed: ${errorMsg}`);
        }

        return result.data;
    }

    /**
     * Extract JSON from text (find first { to last })
     */
    private static extractJSON(text: string): string | null {
        // 1. Try to find markdown block first (safest)
        const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = text.match(jsonBlockRegex);
        if (match && match[1]) {
            return match[1].trim();
        }

        // 2. Look for Array [...]
        const firstBracket = text.indexOf('[');
        const lastBracket = text.lastIndexOf(']');

        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
            return text.substring(firstBracket, lastBracket + 1);
        }

        // 3. Look for Object {...}
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            return text.substring(firstBrace, lastBrace + 1);
        }

        return null; // Failed to find JSON structure
    }

    private static generateRequestId(): string {
        return `ml-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private static sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
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
