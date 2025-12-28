import pool, { safeQuery } from '../../../lib/db';
import logger from '../../../utils/infrastructure/logger';
import { SimplifiedEmail, CleanEmail, PipelineResult, TransactionType, TransactionDirection, InstrumentType } from '../../../types/transaction.types';
import { InstrumentAutoService } from '../../cards/instruments/InstrumentAutoService';

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
import { StatementParserFactory } from '../../statements/StatementParserFactory';
import { StatementReconciler } from '../../statements/StatementReconciler';
import { MerchantEnricher } from '../enrichment/MerchantEnricher';
import { BankPDFPasswordResolver } from '../../statements/password/BankPDFPasswordResolver';

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
    statementParserFactory: typeof StatementParserFactory;
    statementReconciler: typeof StatementReconciler;
}

export class UniversalTransactionPipeline {
    constructor(private deps: IPipelineDependencies) { }

    async processEmail(
        userId: string,
        rawEmail: SimplifiedEmail,
        jobId: string,
        fetchAttachmentFn: (msgId: string, attId: string) => Promise<Buffer | null>
    ): Promise<PipelineResult> {
        return this.processEmailInternal(userId, rawEmail, jobId, fetchAttachmentFn);
    }

    async processEmailInternal(
        userId: string,
        rawEmail: SimplifiedEmail,
        jobId: string,
        fetchAttachmentFn: (msgId: string, attId: string) => Promise<Buffer | null>,
        options: { skipGpt?: boolean } = {}
    ): Promise<PipelineResult> {
        let rawEmailId: string = '';
        const startTime = Date.now();

        try {
            const emailInfo = `[${rawEmail.messageId}] "${rawEmail.subject}"`;
            logger.info(`\n>>> [PIPELINE START] ${emailInfo}`);
            console.log(`[PIPELINE] Processing: ${rawEmail.subject.substring(0, 50)}... [${rawEmail.messageId}]`);

            // ========================================
            // STAGE 1: SAVE RAW (Audit Trail)
            // ========================================
            const s1Start = Date.now();
            // Note: Keeping pool call direct for now as it wasn't in the plan to abstract DB connection
            const rawInsert = await safeQuery(
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
            // STAGE 2.5: ATTACHMENT PROCESSING (Statements)
            // ========================================
            let statementProcessedSuccessfully = false;
            if (cleanEmail.hasAttachments && cleanEmail.attachments) {
                const s2_5Start = Date.now();
                logger.info(`[Pipeline] Stage 2.5: Checking ${cleanEmail.attachments.length} attachments for statements`);

                // Fetch user instruments & profile to generate passwords
                const instruments = await this.deps.instrumentService.getUserInstruments(userId);

                // MOCK PROFILE DATA (In real app, fetch from UserProfileService)
                // For now, we infer from what we have or user ID?
                // We'll rely on the resolver's default + instrument based logic
                const passwordContext = {
                    userName: 'ADITYA', // TODO: Fetch from DB
                    userDob: new Date('2000-01-01'), // TODO: Fetch from DB
                    instruments: instruments
                };

                const candidatePasswords: string[] = [];

                // 1. Generate from context
                // We just map instruments to context format simply
                for (const inst of instruments) {
                    // Check account_number_masked (last 4)
                    const last4 = inst.account_number_masked?.slice(-4);
                    if (last4) {
                        candidatePasswords.push(`ADIT${last4}`); // Keep the specific pattern user liked
                    }
                }

                // 2. Use Resolver
                // (We need to import BankPDFPasswordResolver)
                const resolved = BankPDFPasswordResolver.generateCandidates({
                    userName: 'ADITYA',
                    accountLast4: instruments[0]?.account_number_masked?.slice(-4)
                });

                candidatePasswords.push(...resolved);

                const uniquePasswords = [...new Set(candidatePasswords)];
                if (uniquePasswords.length > 0) {
                    logger.info(`[Pipeline] Generated ${uniquePasswords.length} candidate passwords for protected statements`);
                }

                for (const att of cleanEmail.attachments) {
                    if (att.mimeType === 'application/pdf' || att.filename.toLowerCase().endsWith('.pdf')) {
                        try {
                            const statement = await this.deps.statementParserFactory.process(att.data, uniquePasswords);
                            if (statement) {
                                logger.info(`[Pipeline] Successfully processed statement for ${att.filename}: ${statement.transactions.length} txns (${statement.bankName})`);

                                const stats = await this.deps.statementReconciler.reconcile(statement, userId);
                                logger.info(`[Pipeline] Reconciliation Stats: matched=${stats.matched}, inserted=${stats.newInserted}`);

                                // Mark that we successfully processed a statement
                                if (stats.matched > 0 || stats.newInserted > 0) {
                                    statementProcessedSuccessfully = true;
                                    logger.info(`[Pipeline] Statement processed successfully, will bypass broad detection`);
                                }
                            }
                        } catch (err) {
                            logger.warn(`[Pipeline] Failed to process attachment ${att.filename}`, err);
                        }
                    }
                }
                logger.debug(`[Pipeline] Stage 2.5 (Attachments) took ${Date.now() - s2_5Start}ms`);
            }

            // ========================================
            // STAGE 3: BROAD DETECTION (Financial?)
            // Skip if we successfully processed a statement in Stage 2.5
            // ========================================
            const s3Start = Date.now();
            let isBroadFinancial = statementProcessedSuccessfully; // Auto-pass if statement was processed

            if (!statementProcessedSuccessfully) {
                const text = cleanEmail.subject + ' ' + cleanEmail.cleanedBody;
                isBroadFinancial = this.deps.broadDetector.isFinancialEmail(text);
            }
            logger.info(`[Pipeline] Stage 3 (Broad Detection) took ${Date.now() - s3Start}ms. Result: ${isBroadFinancial ? 'PASS' : 'FAIL'}${statementProcessedSuccessfully ? ' (Statement bypass)' : ''}`);

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

            logger.info(`[Pipeline] Stage 4: Starting classification. cleanEmail.id=${cleanEmail.id}`);

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
                if (options.skipGpt) {
                    logger.info(`[Pipeline] Skiping GPT for now, queuing for background worker.`);
                    return {
                        status: 'queued_for_gpt',
                        cleanEmail, // Pass this out so queue manager can use it
                        rawEmailId
                    } as any; // Cast as any if Types not yet updated, or strictly typed if possible
                }

                logger.info(`[Pipeline] Classification: Low confidence (${classificationResult?.confidence}). Attempting GPT fallback.`);
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

                // CHECK: If GPT returned non_financial, terminate immediately
                if (classificationResult && classificationResult.type === 'non_financial') {
                    await this.deps.terminator.terminate(
                        userId,
                        cleanEmail.id,
                        `GPT classification: non-financial (${classificationResult.metadata?.reason || 'No reason'})`,
                        'stage_4_gpt_fallback',
                        'NON_FINANCIAL',
                        jobId,
                        rawEmailId
                    );
                    logger.info(`<<< [PIPELINE END] ${rawEmail.messageId} - Terminated (GPT Non-Financial)`);
                    return { status: 'terminated', reason: 'non_financial' };
                }

                classificationStage = 'stage_4_gpt_fallback';
            }
            logger.info(`[Pipeline] Stage 4 (Classify) took ${Date.now() - s4Start}ms via ${classificationMethod}`);
            console.log(`[PIPELINE] Classification: ${classificationResult?.type} (Confidence: ${classificationResult?.confidence}) Method: ${classificationMethod}`);

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
            // STAGE 5 & 6: EXTRACT & PERSIST
            // ========================================
            return this.extractAndPersist(
                userId,
                cleanEmail,
                classificationResult,
                classificationMethod,
                jobId,
                rawEmailId,
                new Date(rawEmail.internalDate),
                rawEmail.messageId,
                rawEmail.subject,
                rawEmail.from,
                startTime
            );

        } catch (error) {
            logger.error(`[Pipeline] Fatal error processing email ${rawEmail.messageId}:`, {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
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

            return { status: 'failed', reason: 'pipeline_error', error: error instanceof Error ? error.message : String(error) };
        }
    }

    private async extractAndPersist(
        userId: string,
        cleanEmail: CleanEmail,
        classificationResult: any,
        classificationMethod: string,
        jobId: string,
        rawEmailId: string,
        internalDate: Date,
        messageId: string,
        subject: string,
        sender: string,
        startTime: number
    ): Promise<PipelineResult> {
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
                transactionDate: new Date(internalDate),
                merchant: subject,
                category: 'Unclassified',
                amount: 0.01,
                transactionType: 'unclassified',
                emailMessageId: cleanEmail.id,
                emailSubject: subject,
                emailSender: sender,
                classificationMethod,
                confidenceScore: classificationResult.confidence,
                needsReview: true,
                reviewReason: 'User classified as unclassified or GPT fallback',
                rawEmailId,
                scanJobId: jobId,
                rawExtraction: classificationResult
            });

            logger.info(`<<< [PIPELINE END] ${messageId} - Marked for Review (Unclassified)`);
            return { status: 'needs_review', reason: 'unclassified' };
        }

        try {
            logger.info(`[Pipeline] Stage 5: Starting extraction with ${classificationResult.type} extractor`);
            const Extractor = this.deps.extractorFactory.getExtractor(classificationResult.type as TransactionType);
            extracted = await Extractor.extract(userId, cleanEmail);

            // === ENRICHMENT ===
            try {
                // Enrich Merchant Name & Category
                const enriched = MerchantEnricher.enrich(extracted.merchant || '');

                // If we found a good match (confidence > 0.8), update the data
                // Or if the original was "Unknown Merchant" and we got something better
                if (enriched.confidence >= 0.8) {
                    logger.info(`[Pipeline] Enriched merchant: "${extracted.merchant}" -> "${enriched.canonicalName}" [${enriched.category}]`);
                    extracted.merchant = enriched.canonicalName;

                    // Update category if the current one is generic/missing and we have a specific one
                    if ((!extracted.category || extracted.category === 'Others' || extracted.category === 'Unclassified') &&
                        enriched.category !== 'Uncategorized') {
                        extracted.category = enriched.category;
                    }
                }
            } catch (enrichError) {
                logger.warn(`[Pipeline] Enrichment failed`, enrichError);
            }

            logger.info(`[Pipeline] Stage 5 (Extract) took ${Date.now() - s5Start}ms. Data: ${extracted.amount} ${extracted.currency} @ ${extracted.merchant}`);
        } catch (error) {
            logger.warn(`[Pipeline] Extraction failed via rules (${error instanceof Error ? error.message : String(error)}). Attempting GPT Fallback.`);

            // Fallback: Use GPT if not already used or if rule based failed
            try {
                // If we haven't tried GPT yet, or if we want to re-try for extraction specifically using GPT
                let gptResult = classificationMethod === 'gpt' ? classificationResult : null;

                if (!gptResult) {
                    gptResult = await this.classifyWithGPT(userId, cleanEmail);
                }

                if (gptResult && gptResult.metadata && gptResult.metadata.amount) {
                    logger.info(`[Pipeline] GPT Fallback Extraction Successful. Using GPT data.`);
                    // Manually construct ExtractedTransaction from GPT data
                    const metadata = gptResult.metadata;

                    // Attempt to find instrument
                    // We default to 'credit_card' or try to guess from metadata if possible? 
                    // GPT metadata doesn't usually have card last 4 unless we change prompt.
                    // But let's check text for card ending using regex as helper.
                    const cardMatch = cleanEmail.cleanedBody.match(/(?:ending|no)\.?\s*[*x#]*(\d{4})/i);
                    const cardLast4 = cardMatch ? cardMatch[1] : undefined;

                    let instrumentId: string | undefined = undefined;
                    if (cardLast4) {
                        const instrument = await InstrumentAutoService.findOrCreateCard(userId, 'credit_card', cardLast4, cleanEmail);
                        instrumentId = instrument.id;
                    }

                    extracted = {
                        type: gptResult.type || TransactionType.CREDIT_CARD_SPEND,
                        direction: TransactionDirection.DEBIT, // Default
                        amount: Number(metadata.amount),
                        currency: (metadata.currency as string) || 'INR',
                        merchant: (metadata.merchant as string) || 'Unknown',
                        instrumentType: InstrumentType.CREDIT_CARD, // Fallback default
                        instrumentId,
                        category: 'Others',
                        fingerprint: 'gpt_' + cleanEmail.id, // Simple fingerprint
                        metadata: {
                            classification: 'gpt_fallback',
                            original_error: String(error)
                        }
                    };
                } else {
                    throw new Error('GPT Fallback failed to extract amount');
                }
            } catch (gptError) {
                logger.error(`[Pipeline] GPT Fallback entirely failed:`, gptError);
                await this.deps.terminator.terminate(
                    userId,
                    cleanEmail.id,
                    `Extraction failed: ${error instanceof Error ? error.message : String(error)}`,
                    'stage_5_extraction',
                    'EXTRACTION_FAILED',
                    jobId,
                    rawEmailId
                );
                return { status: 'failed', reason: 'extraction_error', error: String(error) };
            }
        }

        // ========================================
        // STAGE 6: PERSIST (Save to DB)
        // ========================================
        const s6Start = Date.now();
        const txnResult = await this.deps.transactionsQueries.createTransaction({
            userId,
            instrumentType: extracted.instrumentType,
            instrumentId: extracted.instrumentId || undefined,
            transactionDate: new Date(internalDate),
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
            emailSubject: subject,
            emailSender: sender,
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
            logger.info(`<<< [PIPELINE END] ${messageId} - Is Duplicate`);
            return { status: 'duplicate' };
        }

        const transactionId = txnResult.id;
        logger.info(`[Pipeline] Transaction created successfully: ${transactionId}`);

        // Mark scanned email as processed
        await this.deps.scannedEmailsQueries.updateScannedEmailProcessed(userId, cleanEmail.id, transactionId);

        logger.debug(`[Pipeline] Stage 6 (Persist) took ${Date.now() - s6Start}ms`);
        logger.info(`<<< [PIPELINE END] ${messageId} - Total: ${Date.now() - startTime}ms Transaction: ${transactionId}`);
        console.log(`✅ [PIPELINE SUCCESS] ${messageId} -> Transaction: ${transactionId}`);
        return { status: 'success', transactionId };
    }

    public async processGptOnly(
        userId: string,
        cleanEmail: CleanEmail,
        jobId: string,
        rawEmailId: string
    ): Promise<PipelineResult> {
        const startTime = Date.now();
        logger.info(`[Pipeline-GPT] Starting GPT-only processing for ${cleanEmail.id}`);

        try {
            const gptResult = await this.classifyWithGPT(userId, cleanEmail);
            let classificationResult = gptResult;
            let classificationMethod = 'gpt';

            // CHECK: If GPT returned non_financial, terminate immediately
            if (classificationResult && (classificationResult as any).type === 'non_financial') {
                await this.deps.terminator.terminate(
                    userId,
                    cleanEmail.id,
                    `GPT classification: non-financial (${classificationResult.metadata?.reason || 'No reason'})`,
                    'stage_4_gpt_fallback',
                    'NON_FINANCIAL',
                    jobId,
                    rawEmailId
                );
                logger.info(`<<< [PIPELINE-GPT END] ${cleanEmail.id} - Terminated (GPT Non-Financial)`);
                return { status: 'terminated', reason: 'non_financial' };
            }

            // If confidence is still low, maybe fallback to Unclassified?
            if (!classificationResult || classificationResult.confidence < 0.75) {
                // ... termination logic copied or reused ...
                logger.warn(`[Pipeline-GPT] Low confidence (${classificationResult?.confidence || 0}), marking for review`);
                // Just proceed to extractAndPersist which handles unclassified if we set type='unclassified'
                // OR we can manually do what the main flow does.
                // Main flow sets needsReview=true.
                // Let's rely on extractAndPersist handling 'unclassified' if we coerced it,
                // BUT extractAndPersist logic for 'unclassified' is specific.

                // Simpler: Just reconstruct the 'Unclassified' result object if confidence is low
                // and pass it to extractAndPersist?
                // Wait, extractAndPersist has specific check: if (classificationResult.type === 'unclassified')

                // So if low confidence:
                await this.deps.terminator.terminate(
                    userId,
                    cleanEmail.id,
                    `Low confidence classification: ${classificationResult?.confidence || 0}`,
                    'stage_4_gpt_fallback_low_conf',
                    'LOW_CONFIDENCE',
                    jobId,
                    rawEmailId
                );

                // We fake a result so extractAndPersist logs it as review needed
                classificationResult = {
                    type: 'unclassified',
                    confidence: classificationResult?.confidence || 0,
                    metadata: {}
                } as any;
            }

            return this.extractAndPersist(
                userId,
                cleanEmail,
                classificationResult,
                classificationMethod,
                jobId,
                rawEmailId,
                new Date(cleanEmail.internalDate),
                cleanEmail.id, // messageId
                cleanEmail.subject,
                cleanEmail.from,
                startTime
            );

        } catch (err) {
            logger.error(`[Pipeline-GPT] Error:`, err);
            return { status: 'failed', reason: 'gpt_error', error: String(err) };
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
    scannedEmailsQueries: scannedEmailsQueries,
    statementParserFactory: StatementParserFactory,
    statementReconciler: StatementReconciler
});
