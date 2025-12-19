import { SanitizerService } from '../sanitize/sanitizer';
// import { FilterService } from '../filters/filterService';
import { TerminatorService } from '../terminator/terminator';
import pool from '../../lib/db';
import logger from '../../utils/logger';
import { gptQueue } from '../queue/gptQueue'; // Legacy queue for fallback
import { ResolutionService } from '../cards/resolution.service';
import { SimplifiedEmail } from '../../types';

interface PipelineStats {
    processed: number;
    success: number;
    terminated: number;
    failed: number;
    queuedGpt: number;
}

export class PipelineService {

    /**
     * Process a single email through the unified pipeline
     */
    static async processEmail(
        userId: string,
        rawEmail: SimplifiedEmail,
        jobId: string,
        fetchAttachmentFn: (msgId: string, attId: string) => Promise<Buffer | null>
    ): Promise<'success' | 'terminated' | 'queued_gpt' | 'failed'> {

        let rawEmailId: string;
        try {
            // 1. SAVE RAW (Audit Trail)
            const rawInsert = await pool.query(
                `INSERT INTO gmail_scanned_emails (user_id, message_id, internal_date, raw_snippet, scan_job_id, scanned_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())
                 ON CONFLICT (user_id, message_id) DO UPDATE SET 
                   scan_job_id = EXCLUDED.scan_job_id
                 RETURNING id`,
                [userId, rawEmail.messageId, rawEmail.internalDate, rawEmail.snippet || '', jobId]
            );
            rawEmailId = rawInsert.rows[0].id;
        } catch (e) {
            logger.error(`[Pipeline] Failed to save raw email ${rawEmail.messageId}`, e);
            throw e;
        }

        const emailInfo = `[${rawEmail.messageId}] "${rawEmail.subject}" (${new Date(rawEmail.internalDate).toISOString()})`;
        logger.info(`[Pipeline] Processing ${emailInfo}`);

        try {
            // 2. SANITIZE
            const cleanEmail = await SanitizerService.sanitize(rawEmail, fetchAttachmentFn);

            // 3. STATEMENT CHECK (Part 6)
            // PDF + Keywords (statement, billing cycle, payment due date, total amount due)
            const textLower = (cleanEmail.subject + ' ' + cleanEmail.cleanedBody).toLowerCase();
            const isStatement = cleanEmail.hasAttachments &&
                cleanEmail.attachments?.some(a => a.mimeType === 'application/pdf' || a.filename.endsWith('.pdf')) &&
                (
                    textLower.includes('statement') ||
                    textLower.includes('billing cycle') ||
                    textLower.includes('payment due date') ||
                    textLower.includes('total amount due')
                );

            if (isStatement) {
                logger.debug(`[Pipeline] Detected Statement: ${cleanEmail.id}`);
                return await this.processStatement(userId, cleanEmail, jobId, rawEmailId);
            }

            logger.debug(`[Pipeline] Checks - Statement: ${isStatement}, Financial: Checking...`);

            // 4. SPEND EVALUATION (Part 2, 3, 4)
            const { BroadTransactionDetector } = await import('../rules/BroadTransactionDetector');
            const { CreditCardSpendEvaluatorV4 } = await import('../rules/CreditCardSpendEvaluatorV4');

            const text = cleanEmail.subject + ' ' + cleanEmail.cleanedBody;

            const isFinancial = BroadTransactionDetector.isFinancialEmail(text);
            logger.debug(`[Pipeline] Broad Filter: ${isFinancial ? 'PASS' : 'FAIL'}`);

            if (!isFinancial) {
                await TerminatorService.terminate(
                    userId,
                    cleanEmail.id,
                    "Not a financial email",
                    "broad_filter",
                    "NON_FINANCIAL",
                    jobId
                );
                return 'terminated';
            }

            const evalResult = CreditCardSpendEvaluatorV4.evaluate(cleanEmail);

            logger.info(`[Pipeline] Rule Evaluator: ${evalResult.decision} (Score: ${evalResult.score}). Reasons: ${evalResult.reasons.join(', ')}`);

            // Discards are silent to prevent log noise (TerminatorService logs them if needed)

            // 5. ROUTING
            if (evalResult.decision === 'DISCARD') {
                await TerminatorService.terminate(
                    userId,
                    cleanEmail.id,
                    `Score ${evalResult.score}: ${evalResult.reasons.join(', ')}`,
                    'evaluator',
                    'LOW_CONFIDENCE',
                    jobId
                );
                return 'terminated';
            }

            if (evalResult.decision === 'ACCEPT') {
                return await this.processTransaction(userId, cleanEmail, evalResult, jobId, rawEmailId);
            }

            if (evalResult.decision === 'REVIEW') {
                // < 0.60 is discard (handled above). 
                // 0.60 - 0.79 is Review. We use GPT as the "Review" mechanism for now to see if it can extract better.
                logger.info(`[Pipeline] Queuing for GPT Review (Score ${evalResult.score})`);
                gptQueue.enqueue({
                    ...cleanEmail.raw, // Pass raw for GPT
                    userId,
                    scanJobId: jobId,
                    rawEmailId
                });
                return 'queued_gpt';
            }

            return 'terminated';

        } catch (error) {
            logger.error(`[Pipeline] Error processing ${rawEmail.messageId}`, error);
            await pool.query(
                `INSERT INTO email_processing_log (user_id, email_message_id, processing_status, reason, stage, scan_job_id, created_at)
                 VALUES ($1, $2, 'failed', $3, 'pipeline', $4, NOW())
                 ON CONFLICT (email_message_id) DO UPDATE SET processing_status='failed'`,
                [userId, rawEmail.messageId, error instanceof Error ? error.message : String(error), jobId]
            );
            return 'failed';
        }
    }

    private static async processTransaction(
        userId: string,
        email: any, // cleanEmail
        evalResult: any,
        jobId: string,
        rawEmailId: string
    ): Promise<'success'> {
        const { StrictExtractor } = await import('../extraction/StrictExtractor');

        // 1. Strict Extraction (Part 5)
        const text = email.subject + ' ' + email.cleanedBody;

        // Prefer metadata from evaluator, but refine with strict extractor
        let last4 = StrictExtractor.extractLast4(text) || evalResult.metadata.cardLast4;
        let bankName = StrictExtractor.extractBankName(text, email.from) || 'Unknown Bank';

        // 2. Resolve Card
        // If we don't have last4, we can't link to a card safely.
        // But "Card Presence" passed, so maybe we have partial info?
        // With ACCEPT, we expect high quality.

        let cardId: string | undefined;
        if (last4 && bankName) {
            const card = await ResolutionService.resolveCard(userId, bankName, last4);
            if (card) cardId = card.id;
        }

        // 3. Create Transaction - Validate amount first
        const amount = evalResult.metadata.amount;
        if (!amount || amount <= 0) {
            logger.debug(`[Pipeline] Skipping transaction with invalid amount: ${amount}`);
            // Log as terminated instead of creating invalid transaction
            await TerminatorService.terminate(
                userId,
                email.id,
                `Invalid amount: ${amount}`,
                'rule_processing',
                'INVALID_AMOUNT',
                jobId
            );
            return 'success'; // Return success to not break the flow
        }

        await ResolutionService.createTransaction(userId, {
            amount: amount,
            currency: 'INR', // Default to INR if missing
            date: evalResult.metadata.date || new Date(),
            description: evalResult.metadata.merchant || 'Unknown Merchant',
            merchant: evalResult.metadata.merchant || 'Unknown Merchant',
            cardId: cardId,
            externalId: email.id,
            type: 'debit'
        }, {
            gmailMessageId: email.id,
            gmailThreadId: email.raw?.threadId || '',
            rawEmailId: rawEmailId,
            confidence: evalResult.score,
            extractionMethod: 'deterministic_v2'
        });

        // 4. Log Success
        await pool.query(
            `INSERT INTO email_processing_log (user_id, email_message_id, processing_status, reason, stage, status_category, scan_job_id, created_at)
             VALUES ($1, $2, 'success', $3, 'rule_processing', 'TRANSACTION', $4, NOW()) 
             ON CONFLICT (email_message_id) 
             DO UPDATE SET processing_status='success'`,
            [userId, email.id, `Accepted Score: ${evalResult.score}`, jobId]
        );

        return 'success';
    }

    // Circuit Breaker for PDF Failures
    private static jobPdfFailureCounts = new Map<string, number>();
    private static readonly MAX_PDF_FAILURES = 5;

    private static async processStatement(
        userId: string,
        email: any,
        jobId: string,
        rawEmailId: string
    ): Promise<'success' | 'failed'> {
        // 1. Circuit Breaker Check
        const failureCount = this.jobPdfFailureCounts.get(jobId) || 0;
        if (failureCount >= this.MAX_PDF_FAILURES) {
            // Log only once when we first cross the threshold, or just debug
            if (failureCount === this.MAX_PDF_FAILURES) {
                logger.warn(`[Pipeline] PDF Circuit Breaker TRIPPED for job ${jobId}. Skipping future statements.`);
                this.jobPdfFailureCounts.set(jobId, failureCount + 1); // Increment to avoid spamming this warn
            } else {
                logger.debug(`[Pipeline] Skipping Statement PDF (Circuit Breaker) for ${email.id}`);
            }
            return 'success'; // Gracefully skip
        }

        const { StatementProcessor } = require('../extraction/statement'); // Dynamic to avoid circular

        if (!email.attachments || email.attachments.length === 0) return 'success';

        let extractedCount = 0;
        for (const att of email.attachments) {
            try {
                const txns = await StatementProcessor.process(email, att.data);
                for (const txn of txns) {
                    await ResolutionService.createTransaction(userId, {
                        ...txn,
                        type: 'debit',
                        description: txn.description || 'Statement Txn'
                    }, {
                        gmailMessageId: email.id,
                        gmailThreadId: email.raw?.threadId || '',
                        rawEmailId: rawEmailId,
                        confidence: 0.95,
                        extractionMethod: 'statement_pdf'
                    });
                    extractedCount++;
                }

                if (extractedCount > 0) {
                    await pool.query(
                        `INSERT INTO email_processing_log (user_id, email_message_id, processing_status, reason, stage, status_category, scan_job_id, created_at)
                         VALUES ($1, $2, 'success', $3, 'pdf_processing', 'STATEMENT', $4, NOW())
                         ON CONFLICT (email_message_id) DO UPDATE SET processing_status='success'`,
                        [userId, email.id, `Extracted ${extractedCount} txns`, jobId]
                    );
                }
            } catch (e: any) {
                // Circuit Breaker Update
                const currentFailures = this.jobPdfFailureCounts.get(jobId) || 0;
                this.jobPdfFailureCounts.set(jobId, currentFailures + 1);

                // Reduce Log Noise: Log stack only if it's the first few failures
                if (currentFailures < 3) {
                    logger.error(`[Pipeline] Statement PDF fail for ${email.id}: ${e.message}`, e);
                } else {
                    logger.warn(`[Pipeline] Statement PDF fail for ${email.id}: ${e.message} (Failure ${currentFailures + 1})`);
                }
            }
        }

        return 'success';
    }
}
