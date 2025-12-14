import { TransactionDetector, ExtractedTransaction } from './TransactionDetector';

export interface ProcessingStats {
    total: number;
    saved: number;
    review: number;
    terminated: number;
}

export interface BatchProcessingResult {
    autoSave: ExtractedTransaction[];
    needsReview: ExtractedTransaction[];
    terminated: Array<{ emailId: string; reason: string }>;
    stats: ProcessingStats;
}

export class RuleBasedProcessor {
    private detector: TransactionDetector;

    constructor() {
        this.detector = new TransactionDetector();
    }

    /**
     * Process a batch of email rows (e.g. from CSV or scanning)
     */
    async processEmailRows(
        userId: string,
        rows: any[]
    ): Promise<BatchProcessingResult> {
        const result: BatchProcessingResult = {
            autoSave: [],
            needsReview: [],
            terminated: [],
            stats: { total: 0, saved: 0, review: 0, terminated: 0 }
        };

        result.stats.total = rows.length;

        for (const row of rows) {
            try {
                // Normalize typical input formats
                const subject = row.subject || '';
                const sender = row.sender || row.from || '';
                const snippet = row.snippet || '';
                const messageId = row.message_id || row.id || `temp_${Date.now()}_${Math.random()}`;
                const internalDate = row.internal_date ? parseInt(row.internal_date) : Date.now();
                const fullContent = row.cleaned_text || row.bodyText || row.body || '';

                // 1. Detection Phase
                // We use the same detector for both simple check and extraction to avoid double parsing.
                // Actually detector.extractTransaction includes the detection logic.

                const extracted = this.detector.extractTransaction(
                    messageId,
                    userId,
                    subject,
                    sender,
                    snippet,
                    internalDate,
                    fullContent
                );

                if (!extracted) {
                    result.terminated.push({
                        emailId: messageId,
                        reason: 'Not a transaction or filtered by terminator'
                    });
                    continue;
                }

                // 2. Routing Decision
                if (extracted.needsReview) {
                    // Double check thresholds explicitly if needed, but detector sets .needsReview based on < 0.75
                    if (extracted.confidence < 0.60) {
                        // "Else -> Add to terminated" per specs
                        result.terminated.push({
                            emailId: messageId,
                            reason: `Low confidence (${extracted.confidence})`
                        });
                    } else {
                        result.needsReview.push(extracted);
                    }
                } else {
                    // High confidence -> Auto Save
                    result.autoSave.push(extracted);
                }

            } catch (error) {
                // Fail safe - log but don't stop batch
                console.error(`Status: Error processing row ${row.message_id || 'unknown'}`, error);
                result.terminated.push({
                    emailId: row.message_id || 'unknown',
                    reason: `Error: ${error instanceof Error ? error.message : String(error)}`
                });
            }
        }

        // Update stats
        result.stats.saved = result.autoSave.length;
        result.stats.review = result.needsReview.length;
        result.stats.terminated = result.terminated.length;

        return result;
    }
}
