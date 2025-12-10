import { OllamaService } from '../services/ollama.service';
import { MLClassificationResult } from '../types/ml-schema';

/**
 * Merchant Extractor - ML-Only Version
 * 
 * IMPORTANT: This class now delegates 100% to ML for merchant extraction.
 * ALL regex-based patterns, keyword indicators, and heuristics have been removed.
 * 
 * This is now just a thin wrapper around the ML service for backward compatibility.
 * Consider deprecating this class entirely and using CreditCardMailDetector directly.
 */
export class MerchantExtractor {
    /**
     * Extract merchant name from email text using ML
     * 
     * @param text Email text (preferably cleaned)
     * @returns Merchant name or null if not a transaction
     * @deprecated Use CreditCardMailDetector.detect() instead for full context
     */
    static async extract(text: string): Promise<string | null> {
        try {
            if (!text || text.length < 10) {
                return null;
            }

            const mlResult: MLClassificationResult = await OllamaService.classifyEmail(text);

            // Only return merchant if it's actually a transaction
            if (mlResult.isTransaction && mlResult.merchant) {
                return mlResult.merchant;
            }

            return null;

        } catch (error) {
            console.error('[MerchantExtractor] ML extraction failed:', error);
            return null;
        }
    }

    /**
     * Batch extract merchants from multiple emails
     * 
     * @param texts Array of email texts
     * @param concurrency Parallel processing limit
     * @returns Array of merchant names (null for non-transactions)
     */
    static async extractBatch(
        texts: string[],
        concurrency: number = 5
    ): Promise<(string | null)[]> {
        const { default: pLimit } = await import('p-limit');
        const limit = pLimit(concurrency);

        const tasks = texts.map(text =>
            limit(() => this.extract(text))
        );

        return Promise.all(tasks);
    }
}
