import pool from '../../../lib/db';
import logger from '../../../utils/infrastructure/logger';
import { SimplifiedEmail, CleanEmail, PipelineResult, TransactionType } from '../../../types/transaction.types';

import { SanitizerService } from '../../gmail/sanitize/sanitizer';
import { BroadFinancialDetector } from '../detection/BroadFinancialDetector';
import { TerminatorService } from '../../infrastructure/termination/TerminatorService';
import { ClassifierRegistry } from '../classification/ClassifierRegistry';
import { GPTClassifier } from '../classification/GPTClassifier';
import { EnhancedRuleClassifier } from '../classification/EnhancedRuleClassifier';
import { TransactionExtractorFactory } from '../extraction/TransactionExtractorFactory';
import { InstrumentService } from '../../cards/instruments/InstrumentService';
import { ManualReviewService } from '../../infrastructure/error-recovery/ManualReviewService';
import { ErrorRecoveryManager } from '../../infrastructure/error-recovery/ErrorRecoveryManager';
import * as transactionsQueries from '../../../db/queries/transactions.queries';
import * as scannedEmailsQueries from '../../../db/queries/scanned_emails.queries';

export interface IPipelineDependencies {
    sanitizer: typeof SanitizerService;
    broadDetector: typeof BroadFinancialDetector;
    terminator: typeof TerminatorService;
    classifierRegistry: typeof ClassifierRegistry;
    gptClassifier: typeof GPTClassifier;
    enhancedClassifier: typeof EnhancedRuleClassifier;
    extractorFactory: typeof TransactionExtractorFactory;
    instrumentService: typeof InstrumentService;
    manualReview: typeof ManualReviewService;
    errorRecovery: typeof ErrorRecoveryManager;
    transactionsQueries: typeof transactionsQueries;
    scannedEmailsQueries: typeof scannedEmailsQueries;
}

export class UniversalTransactionPipeline {
    constructor(private deps: IPipelineDependencies) { }

    async processEmail(
        userId: string,
        rawEmail: SimplifiedEmail,
        jobId: string,
        fetchAttachmentFn: (msgId: string, attId: string) => Promise<Buffer | null>
    ): Promise<PipelineResult> {
        let rawEmailId: string = '';
        const startTime = Date.now();

        try {
            const emailInfo = `[${rawEmail.messageId}] "${rawEmail.subject}"`;
            logger.info(`\n>>> [PIPELINE START] ${emailInfo}`);

            // ========================================
            // STAGE 1: SAVE RAW (Audit Trail)
            // ========================================
            const s1Start = Date.now();
            // Note: Keeping pool call direct for now as it wasn't in the plan to abstract DB connection
            const rawInsert = await pool.query(
                `INSERT INTO gmail_scanned_emails 
         (user_id, message_id, internal_date, raw_snippet, scan_job_id, scanned_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id, message_id) DO UPDATE SET scan_job_id = EXCLUDED.scan_job_id
         RETURNING id`,
                [userId, rawEmail.messageId, rawEmail.internalDate, rawEmail.snippet || '', jobId]
            );
            rawEmailId = rawInsert.rows[0].id;
            logger.debug(`[Pipeline] Stage 1 (Audit) took ${Date.now() - s1Start}ms`);

            // ========================================
            // STAGE 2: SANITIZE (Extract & Clean Text)
            // ========================================
            const s2Start = Date.now();
            const cleanEmail = await this.deps.sanitizer.sanitize(rawEmail, fetchAttachmentFn);
            logger.debug(`[Pipeline] Stage 2 (Sanitize) took ${Date.now() - s2Start}ms`);

            // ========================================
            // STAGE 3: BROAD DETECTION (Financial?)
            // ========================================
            const s3Start = Date.now();
            const text = cleanEmail.subject + ' ' + cleanEmail.cleanedBody;
            const isBroadFinancial = this.deps.broadDetector.isFinancialEmail(text);
            logger.info(`[Pipeline] Stage 3 (Broad Detection) took ${Date.now() - s3Start}ms. Result: ${isBroadFinancial ? 'PASS' : 'FAIL'}`);

            if (!isBroadFinancial) {
                await this.deps.terminator.terminate(
                    userId,
                    cleanEmail.id,
                    'Not a financial email (broad filter)',
                    'stage_3_broad_detection',
                    'NON_FINANCIAL',
                    jobId,
                    rawEmailId
                );
                logger.info(`<<< [PIPELINE END] ${rawEmail.messageId} - Terminated (Non-Financial)`);
                return { status: 'terminated', reason: 'non_financial' };
            }

            // NEW: Exclusion Layer (Stage 2.5)
            const exclusionCheck = this.deps.enhancedClassifier.checkExclusions(cleanEmail);
            if (exclusionCheck.isExcluded) {
                await this.deps.terminator.terminate(
                    userId,
                    cleanEmail.id,
                    `Excluded by pattern: ${exclusionCheck.matchedPattern}`,
                    'stage_2_exclusion',
                    'NON_FINANCIAL',
                    jobId,
                    rawEmailId
                );
                logger.info(`<<< [PIPELINE END] ${rawEmail.messageId} - Terminated (Excluded: ${exclusionCheck.matchedPattern})`);
                return { status: 'terminated', reason: 'exclusion_match' };
            }

            // ========================================
            // STAGE 4: CLASSIFY TYPE (What kind?)
            // ========================================
            const s4Start = Date.now();
            let classificationResult = null;
            let classificationMethod = 'rule_based';
            let classificationStage = 'stage_4_rule_based';

            // STEP 1: Try Enhanced Rule Classifier
            try {
                const enhancedResult = this.deps.enhancedClassifier.classify(cleanEmail);
                if (enhancedResult) {
                    if (enhancedResult.confidence >= 0.85 && enhancedResult.type !== 'non_financial') {
                        // High confidence rule match
                        classificationResult = enhancedResult;
                        classificationMethod = 'enhanced_rule';
                        logger.info(`[Pipeline] Enhanced Rule Match: ${enhancedResult.type} (${enhancedResult.confidence.toFixed(2)})`);
                    } else if (enhancedResult.type === 'non_financial') {
                        // Explicit non-financial match
                        await this.deps.terminator.terminate(
                            userId,
                            cleanEmail.id,
                            `Enhanced classifier: non-financial (${enhancedResult.metadata?.pattern})`,
                            'stage_4_enhanced_rule',
                            'NON_FINANCIAL',
                            jobId,
                            rawEmailId
                        );
                        return { status: 'terminated', reason: 'non_financial' };
                    }
                }
            } catch (error) {
                logger.warn('[Pipeline] EnhancedRuleClassifier failed:', error);
            }

            // STEP 2: GPT Fallback with strict checks
            const isLowConfidence = !classificationResult || (classificationResult.confidence < 0.85);

            if (isLowConfidence) {
                logger.info(`[Pipeline] Low confidence/No rule match, attempting GPT classification...`);
                const gptResult = await this.classifyWithGPT(userId, cleanEmail);

                if (gptResult) {
                    // Result Merging Strategy
                    // If we had a weak rule match, we might want to combine insights
                    if (classificationResult && classificationResult.type === gptResult.type) {
                        // Same type, boost confidence?
                        // For now, trust GPT if confidence is decent
                        classificationResult = gptResult;
                        classificationMethod = 'gpt';
                    } else if (gptResult.confidence > 0.7) {
                        // GPT found something significant
                        classificationResult = gptResult;
                        classificationMethod = 'gpt';
                    }
                }

                classificationStage = 'stage_4_gpt_fallback';
            }
            logger.info(`[Pipeline] Stage 4 (Classify) took ${Date.now() - s4Start}ms via ${classificationMethod}`);

            // If verification failed or confidence is low, set needs_review
            if (!classificationResult || classificationResult.confidence < 0.75) {
                logger.warn(`[Pipeline] Low confidence (${classificationResult?.confidence || 0}), marking for review`);
                await this.deps.terminator.terminate(
                    userId,
                    cleanEmail.id,
                    `Low confidence classification: ${classificationResult?.confidence || 0}`,
                    classificationStage,
                    'LOW_CONFIDENCE',
                    jobId,
                    rawEmailId
                );

                // Save as unclassified transaction for review
                await this.deps.transactionsQueries.createTransaction({
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

                logger.info(`<<< [PIPELINE END] ${rawEmail.messageId} - Needs Review`);
                return { status: 'needs_review', reason: 'low_confidence' };
            }

            // ========================================
            // STAGE 5: EXTRACT DATA (Normalize)
            // ========================================
            const s5Start = Date.now();
            let extracted;

            // If classification is 'unclassified', skip extraction and mark for review
            if (classificationResult.type === 'unclassified') {
                logger.info(`[Pipeline] Skipping extraction for unclassified type, marking for review`);
                await this.deps.transactionsQueries.createTransaction({
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

                logger.info(`<<< [PIPELINE END] ${rawEmail.messageId} - Marked for Review (Unclassified)`);
                return { status: 'needs_review', reason: 'unclassified' };
            }

            try {
                const Extractor = this.deps.extractorFactory.getExtractor(classificationResult.type as TransactionType);
                extracted = await Extractor.extract(userId, cleanEmail);
                logger.info(`[Pipeline] Stage 5 (Extract) took ${Date.now() - s5Start}ms. Data: ${extracted.amount} ${extracted.currency} @ ${extracted.merchant}`);
            } catch (error) {
                logger.error(`[Pipeline] Extraction failed for ${cleanEmail.id} (${classificationResult.type}):`, error);
                await this.deps.terminator.terminate(
                    userId,
                    cleanEmail.id,
                    `Extraction failed: ${error instanceof Error ? error.message : String(error)}`,
                    'stage_5_extraction',
                    'EXTRACTION_FAILED',
                    jobId,
                    rawEmailId
                );
                logger.warn(`<<< [PIPELINE END] ${rawEmail.messageId} - Extraction Failed`);
                return { status: 'failed', reason: 'extraction_error', error: String(error) };
            }

            // ========================================
            // STAGE 6: PERSIST (Save to DB)
            // ========================================
            const s6Start = Date.now();
            const txnResult = await this.deps.transactionsQueries.createTransaction({
                userId,
                instrumentType: extracted.instrumentType,
                instrumentId: extracted.instrumentId || undefined,
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
                logger.warn(`[Pipeline] Duplicate transaction detected`);
                await this.deps.terminator.terminate(
                    userId,
                    cleanEmail.id,
                    'Duplicate transaction',
                    'stage_6_persist',
                    'DUPLICATE',
                    jobId,
                    rawEmailId
                );
                logger.info(`<<< [PIPELINE END] ${rawEmail.messageId} - Is Duplicate`);
                return { status: 'duplicate' };
            }

            const transactionId = txnResult.id;

            // Mark scanned email as processed
            await this.deps.scannedEmailsQueries.updateScannedEmailProcessed(userId, cleanEmail.id, transactionId);

            logger.debug(`[Pipeline] Stage 6 (Persist) took ${Date.now() - s6Start}ms`);
            logger.info(`<<< [PIPELINE END] ${rawEmail.messageId} - Total: ${Date.now() - startTime}ms Transaction: ${transactionId}`);
            return { status: 'success', transactionId };

        } catch (error) {
            logger.error(`[Pipeline] Fatal error processing email ${rawEmail.messageId}:`, {
                error: error instanceof Error ? error.stack : error,
                userId,
                jobId
            });

            // Handle error recovery
            try {
                const recovery = await this.deps.errorRecovery.handleProcessingError(
                    error instanceof Error ? error : new Error(String(error)),
                    {
                        userId,
                        emailId: rawEmail.messageId,
                        subject: rawEmail.subject,
                        snippet: rawEmail.snippet,
                        currentStage: 'pipeline_error',
                        retryCount: 0,
                        jobId,
                        rawEmailId: rawEmailId || undefined
                    }
                );

                if (recovery.action === 'MANUAL_REVIEW') {
                    await this.deps.manualReview.markForManualReview(
                        {
                            userId,
                            emailId: rawEmail.messageId,
                            subject: rawEmail.subject,
                            snippet: rawEmail.snippet,
                            sender: rawEmail.from,
                            retryCount: 0,
                            jobId
                        },
                        recovery.reason
                    );
                }
            } catch (recoveryError) {
                logger.error('[Pipeline] Error recovery failed:', recoveryError);
            }

            return { status: 'failed', reason: 'pipeline_error', error: String(error) };
        }
    }

    private async classifyWithGPT(userId: string, cleanEmail: CleanEmail) {
        // Fetch user instruments for context
        const instruments = await this.deps.instrumentService.getUserInstruments(userId);

        // Call GPT Classifier (will batch if needed)
        const result = await this.deps.gptClassifier.classify(userId, cleanEmail, instruments);
        return result;
    }
}

// Default Singleton Instance
export const universalPipeline = new UniversalTransactionPipeline({
    sanitizer: SanitizerService,
    broadDetector: BroadFinancialDetector,
    terminator: TerminatorService,
    classifierRegistry: ClassifierRegistry,
    gptClassifier: GPTClassifier,
    enhancedClassifier: EnhancedRuleClassifier,
    extractorFactory: TransactionExtractorFactory,
    instrumentService: InstrumentService,
    manualReview: ManualReviewService,
    errorRecovery: ErrorRecoveryManager,
    transactionsQueries: transactionsQueries,
    scannedEmailsQueries: scannedEmailsQueries
});
