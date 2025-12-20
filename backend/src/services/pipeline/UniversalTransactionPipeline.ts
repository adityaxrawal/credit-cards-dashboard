import pool from '../../lib/db';
import logger from '../../utils/logger';
import { SimplifiedEmail, CleanEmail, PipelineResult } from '../../types/transaction.types';
import { SanitizerService } from '../sanitize/sanitizer';
import { BroadFinancialDetector } from '../detection/BroadFinancialDetector';
import { TerminatorService } from '../termination/TerminatorService';
import { ClassifierRegistry } from '../classification/ClassifierRegistry';
import { GPTClassifier } from '../classification/GPTClassifier';
import { TransactionExtractorFactory } from '../extraction/TransactionExtractorFactory';
import { InstrumentService } from '../instruments/InstrumentService';
import * as transactionsQueries from '../../db/queries/transactions.queries';
import * as scannedEmailsQueries from '../../db/queries/scanned_emails.queries';

export class UniversalTransactionPipeline {
    static async processEmail(
        userId: string,
        rawEmail: SimplifiedEmail,
        jobId: string,
        fetchAttachmentFn: (msgId: string, attId: string) => Promise<Buffer | null>
    ): Promise<PipelineResult> {
        let rawEmailId: string;
        const startTime = Date.now();

        try {
            const emailInfo = `[${rawEmail.messageId}] "${rawEmail.subject}"`;
            console.log(`\n>>> [PIPELINE START] ${emailInfo}`);

            // ========================================
            // STAGE 1: SAVE RAW (Audit Trail)
            // ========================================
            const s1Start = Date.now();
            const rawInsert = await pool.query(
                `INSERT INTO gmail_scanned_emails 
         (user_id, message_id, internal_date, raw_snippet, scan_job_id, scanned_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id, message_id) DO UPDATE SET scan_job_id = EXCLUDED.scan_job_id
         RETURNING id`,
                [userId, rawEmail.messageId, rawEmail.internalDate, rawEmail.snippet || '', jobId]
            );
            rawEmailId = rawInsert.rows[0].id;
            console.log(`[Pipeline] Stage 1 (Audit) took ${Date.now() - s1Start}ms`);

            // ========================================
            // STAGE 2: SANITIZE (Extract & Clean Text)
            // ========================================
            const s2Start = Date.now();
            const cleanEmail = await SanitizerService.sanitize(rawEmail, fetchAttachmentFn);
            console.log(`[Pipeline] Stage 2 (Sanitize) took ${Date.now() - s2Start}ms`);

            // ========================================
            // STAGE 3: BROAD DETECTION (Financial?)
            // ========================================
            const s3Start = Date.now();
            const text = cleanEmail.subject + ' ' + cleanEmail.cleanedBody;
            const isBroadFinancial = BroadFinancialDetector.isFinancialEmail(text);
            console.log(`[Pipeline] Stage 3 (Broad Detection) took ${Date.now() - s3Start}ms. Result: ${isBroadFinancial ? 'PASS' : 'FAIL'}`);

            if (!isBroadFinancial) {
                await TerminatorService.terminate(
                    userId,
                    cleanEmail.id,
                    'Not a financial email (broad filter)',
                    'stage_3_broad_detection',
                    'NON_FINANCIAL',
                    jobId,
                    rawEmailId
                );
                console.log(`<<< [PIPELINE END] ${rawEmail.messageId} - Terminated (Non-Financial)`);
                return { status: 'terminated', reason: 'non_financial' };
            }

            // ========================================
            // STAGE 4: CLASSIFY TYPE (What kind?)
            // ========================================
            const s4Start = Date.now();
            let classificationResult = null;
            let classificationMethod = 'rule_based';
            let classificationStage = 'stage_4_rule_based';

            // Try each deterministic classifier
            const classifiers = ClassifierRegistry.getClassifiers();
            for (const Classifier of classifiers) {
                try {
                    const result = await Classifier.classify(userId, cleanEmail);
                    if (result && result.confidence >= 0.75) {
                        classificationResult = result;
                        console.log(`[Pipeline] Rule Match: ${result.type} (${result.confidence.toFixed(2)})`);
                        break;
                    }
                } catch (error) {
                    logger.warn(`[Pipeline] Classifier ${Classifier.name} failed:`, error);
                    continue;
                }
            }

            // If no high-confidence rule, try GPT
            if (!classificationResult || classificationResult.confidence < 0.75) {
                console.log(`[Pipeline] No rule match, attempting GPT classification...`);
                classificationResult = await this.classifyWithGPT(userId, cleanEmail);
                classificationMethod = 'gpt';
                classificationStage = 'stage_4_gpt_fallback';
            }
            console.log(`[Pipeline] Stage 4 (Classify) took ${Date.now() - s4Start}ms via ${classificationMethod}`);

            // If still low confidence, mark for review
            if (!classificationResult || classificationResult.confidence < 0.50) {
                console.log(`[Pipeline] Low confidence (${classificationResult?.confidence || 0}), marking for review`);
                await TerminatorService.terminate(
                    userId,
                    cleanEmail.id,
                    `Low confidence classification: ${classificationResult?.confidence || 0}`,
                    classificationStage,
                    'LOW_CONFIDENCE',
                    jobId,
                    rawEmailId
                );

                // Save as unclassified transaction for review
                await transactionsQueries.createTransaction({
                    userId,
                    transactionDate: new Date(rawEmail.internalDate),
                    merchant: cleanEmail.subject, // Fallback merchant
                    category: 'Unclassified',
                    amount: 0.01, // Mock amount for unclassified
                    transactionType: 'unclassified',
                    emailMessageId: cleanEmail.id,
                    emailSubject: cleanEmail.subject,
                    emailSender: cleanEmail.from,
                    classificationMethod,
                    confidenceScore: classificationResult?.confidence || 0,
                    needsReview: true,
                    reviewReason: 'Low confidence classification',
                    rawEmailId,
                    scanJobId: jobId,
                    rawExtraction: classificationResult
                });

                console.log(`<<< [PIPELINE END] ${rawEmail.messageId} - Needs Review`);
                return { status: 'needs_review', reason: 'low_confidence' };
            }

            // ========================================
            // STAGE 5: EXTRACT DATA (Normalize)
            // ========================================
            const s5Start = Date.now();
            let extracted;

            // If classification is 'unclassified', skip extraction and mark for review
            if (classificationResult.type === 'unclassified') {
                console.log(`[Pipeline] Skipping extraction for unclassified type, marking for review`);
                await transactionsQueries.createTransaction({
                    userId,
                    transactionDate: new Date(rawEmail.internalDate),
                    merchant: cleanEmail.subject,
                    category: 'Unclassified',
                    amount: 0.01,
                    transactionType: 'unclassified',
                    emailMessageId: cleanEmail.id,
                    emailSubject: cleanEmail.subject,
                    emailSender: cleanEmail.from,
                    classificationMethod,
                    confidenceScore: classificationResult.confidence,
                    needsReview: true,
                    reviewReason: 'User classified as unclassified or GPT fallback',
                    rawEmailId,
                    scanJobId: jobId,
                    rawExtraction: classificationResult
                });

                console.log(`<<< [PIPELINE END] ${rawEmail.messageId} - Marked for Review (Unclassified)`);
                return { status: 'needs_review', reason: 'unclassified' };
            }

            try {
                const Extractor = TransactionExtractorFactory.getExtractor(classificationResult.type);
                extracted = await Extractor.extract(userId, cleanEmail);
                console.log(`[Pipeline] Stage 5 (Extract) took ${Date.now() - s5Start}ms. Data: ${extracted.amount} ${extracted.currency} @ ${extracted.merchant}`);
            } catch (error) {
                logger.error(`[Pipeline] Extraction failed for ${cleanEmail.id} (${classificationResult.type}):`, error);
                await TerminatorService.terminate(
                    userId,
                    cleanEmail.id,
                    `Extraction failed: ${error instanceof Error ? error.message : String(error)}`,
                    'stage_5_extraction',
                    'EXTRACTION_FAILED',
                    jobId,
                    rawEmailId
                );
                console.log(`<<< [PIPELINE END] ${rawEmail.messageId} - Extraction Failed`);
                return { status: 'failed', reason: 'extraction_error', error: String(error) };
            }

            // ========================================
            // STAGE 6: PERSIST (Save to DB)
            // ========================================
            const s6Start = Date.now();
            const txnResult = await transactionsQueries.createTransaction({
                userId,
                instrumentType: extracted.instrumentType,
                instrumentId: extracted.instrumentId || null,
                cardId: extracted.cardId,
                transactionDate: new Date(rawEmail.internalDate),
                merchant: extracted.merchant || 'Unknown Merchant',
                category: extracted.category || 'Others',
                amount: extracted.amount,
                transactionType: classificationResult.type,
                direction: extracted.direction,
                counterpartyName: extracted.counterpartyName,
                counterpartyIdentifier: extracted.counterpartyIdentifier,
                referenceNumber: extracted.referenceNumber,
                txnFingerprint: extracted.fingerprint,
                emailMessageId: cleanEmail.id,
                emailSubject: cleanEmail.subject,
                emailSender: cleanEmail.from,
                classificationMethod,
                confidenceScore: classificationResult.confidence,
                rawEmailId,
                scanJobId: jobId,
                rawExtraction: classificationResult,
                metadata: extracted.metadata || {}
            });

            if (!txnResult) {
                console.log(`[Pipeline] Duplicate transaction detected`);
                await TerminatorService.terminate(
                    userId,
                    cleanEmail.id,
                    'Duplicate transaction',
                    'stage_6_persist',
                    'DUPLICATE',
                    jobId,
                    rawEmailId
                );
                console.log(`<<< [PIPELINE END] ${rawEmail.messageId} - Is Duplicate`);
                return { status: 'duplicate' };
            }

            const transactionId = txnResult.id;

            // Mark scanned email as processed
            await scannedEmailsQueries.updateScannedEmailProcessed(userId, cleanEmail.id, transactionId);

            console.log(`[Pipeline] Stage 6 (Persist) took ${Date.now() - s6Start}ms`);
            console.log(`<<< [PIPELINE END] ${rawEmail.messageId} - Total: ${Date.now() - startTime}ms Transaction: ${transactionId}`);
            return { status: 'success', transactionId };

        } catch (error) {
            logger.error(`[Pipeline] Fatal error processing email ${rawEmail.messageId}:`, {
                error: error instanceof Error ? error.stack : error,
                userId,
                jobId
            });
            return { status: 'failed', reason: 'pipeline_error', error: String(error) };
        }
    }

    private static async classifyWithGPT(userId: string, cleanEmail: CleanEmail) {
        // Fetch user instruments for context
        const instruments = await InstrumentService.getUserInstruments(userId);

        // Call GPT Classifier (will batch if needed)
        const result = await GPTClassifier.classify(userId, cleanEmail, instruments);
        return result;
    }
}
