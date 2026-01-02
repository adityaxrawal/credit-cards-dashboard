import pool, { safeQuery } from '@shared/database/db';
import { dbWriteQueueManager } from '../../../../services/infrastructure/DbWriteQueueManager';
import * as crypto from 'crypto';
import logger from '@shared/utils/infrastructure/logger';
import { SimplifiedEmail, CleanEmail, PipelineResult, TransactionType, TransactionDirection, InstrumentType } from '@shared/types/transaction.types';
import { InstrumentAutoService } from '@modules/cards/instrument-auto.service';
import { BankPDFPasswordResolver } from '@modules/statements/bank-pdf-password-resolver';

import { SanitizerService } from '@modules/gmail/sanitizer';
import { BroadFinancialDetector } from '../detection/BroadFinancialDetector';
import { TerminatorService } from '../../../../services/infrastructure/termination/TerminatorService';
import { ClassifierRegistry } from '../classification/ClassifierRegistry';
// classifierRegistry: typeof ClassifierRegistry; (Previous line)
import { EnhancedRuleClassifier } from '../classification/EnhancedRuleClassifier';

import { TransactionExtractorFactory } from '../extraction/TransactionExtractorFactory';
import { InstrumentService } from '@modules/cards/instrument.service';
import { ManualReviewService } from '../../../../services/infrastructure/error-recovery/ManualReviewService';
import { ErrorRecoveryManager } from '../../../../services/infrastructure/error-recovery/ErrorRecoveryManager';
import { StatementParserFactory } from '@modules/statements/statement-parser-factory';
import { StatementReconciler } from '@modules/statements/statement-reconciler';
import { featureFlags } from '@shared/config/featureFlags';
import { MerchantEnricher } from '../enrichment/MerchantEnricher';
import { UnclassifiedRepository } from '@modules/manual-review/unclassified.repository';
import { UserProfileService } from '@modules/user/user-profile.service';


export interface IPipelineDependencies {
    sanitizer: typeof SanitizerService;
    broadDetector: typeof BroadFinancialDetector;
    terminator: typeof TerminatorService;
    classifierRegistry: typeof ClassifierRegistry;
    // gptClassifier removed
    enhancedClassifier: typeof EnhancedRuleClassifier;
    extractorFactory: typeof TransactionExtractorFactory;
    instrumentService: typeof InstrumentService;
    manualReview: typeof ManualReviewService;
    errorRecovery: typeof ErrorRecoveryManager;
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

    ): Promise<PipelineResult> {
        let rawEmailId: string = '';
        const startTime = Date.now();

        try {
            const emailInfo = `[${rawEmail.messageId}]"${rawEmail.subject}"`;
            logger.info(`\n >>> [PIPELINE START] ${emailInfo} `);
            console.log(`[PIPELINE] Processing: ${rawEmail.subject.substring(0, 50)}...[${rawEmail.messageId}]`);

            // ========================================
            // STAGE 1: SAVE RAW (Audit Trail) - QUEUED, NON-BLOCKING
            // ========================================
            const s1Start = Date.now();
            // Generate UUID client-side for immediate use, queue the DB write
            rawEmailId = crypto.randomUUID();
            dbWriteQueueManager.enqueue('scanned_emails', {
                id: rawEmailId,
                userId,
                messageId: rawEmail.messageId,
                internalDate: rawEmail.internalDate,
                snippet: rawEmail.snippet || '',
                jobId
            });
            logger.debug(`[Pipeline] Stage 1(Audit) queued in ${Date.now() - s1Start}ms`);

            // ========================================
            // STAGE 2: SANITIZE (Extract & Clean Text)
            // ========================================
            const s2Start = Date.now();
            const cleanEmail = await this.deps.sanitizer.sanitize(rawEmail, fetchAttachmentFn);
            logger.debug(`[Pipeline] Stage 2(Sanitize) took ${Date.now() - s2Start} ms`);


            // ========================================
            // STAGE 2.5: ATTACHMENT PROCESSING (Statements)
            // ========================================
            let statementProcessedSuccessfully = false;
            if (cleanEmail.hasAttachments && cleanEmail.attachments) {
                const s2_5Start = Date.now();
                logger.info(`[Pipeline] Stage 2.5: Checking ${cleanEmail.attachments.length} attachments for statements`);

                // Fetch user instruments & profile to generate passwords
                const instruments = await this.deps.instrumentService.getUserInstruments(userId);

                // Fetch real profile context for password generation
                const profileContext = await UserProfileService.getPasswordContext(userId);

                const candidatePasswords: string[] = [];
                const dob = profileContext?.dob || new Date('2000-01-01'); // Fallback purely for safety, though won't match if real DOB different

                // 1. Generate from context
                // We just map instruments to context format simply
                for (const inst of instruments) {
                    // Check account_number_masked (last 4)
                    const last4 = inst.account_number_masked?.slice(-4);
                    if (last4) {
                        candidatePasswords.push(`ADIT${last4}`); // Keep the specific pattern user liked
                        if (profileContext?.firstName) {
                            candidatePasswords.push(`${profileContext.firstName}${last4}`);
                        }
                    }
                }

                // 2. Use Resolver with Expanded Context
                const context = {
                    firstName: profileContext?.firstName || 'User',
                    dob: dob,
                    instruments: instruments
                };

                const resolved = BankPDFPasswordResolver.generateCandidates(context);
                candidatePasswords.push(...resolved);

                // 3. Brute Force Dates (Common for many banks)
                // Add DDMMYYYY and DDMMYY of DOB if not covered
                const dd = String(dob.getDate()).padStart(2, '0');
                const mm = String(dob.getMonth() + 1).padStart(2, '0');
                const yyyy = String(dob.getFullYear());
                const yy = yyyy.slice(-2);

                candidatePasswords.push(`${dd}${mm}${yyyy}`);
                candidatePasswords.push(`${dd}${mm}${yy}`);

                // 4. Name + Date Combinations (Common: ADIT1234)
                if (profileContext?.firstName) {
                    const prefix = profileContext.firstName.substring(0, 4).toUpperCase();
                    candidatePasswords.push(`${prefix}${dd}${mm}`); // First 4 name + DDMM
                    candidatePasswords.push(`${prefix}${yyyy}`);    // First 4 name + YYYY
                } else {
                    candidatePasswords.push(`ADIT${dd}${mm}`); // Fallback
                    candidatePasswords.push(`ADIT${yyyy}`);
                }

                // Add explicit user-provided passwords if any (e.g. from a text file or settings)
                // candidatePasswords.push(...userSettings.customPasswords);

                const uniquePasswords = [...new Set(candidatePasswords)];
                if (uniquePasswords.length > 0) {
                    logger.info(`[Pipeline] Generated ${uniquePasswords.length} candidate passwords for protected statements`);
                }

                for (const att of cleanEmail.attachments) {
                    if (att.mimeType === 'application/pdf' || att.filename.toLowerCase().endsWith('.pdf')) {
                        try {
                            const statement = await this.deps.statementParserFactory.process(att.data, uniquePasswords);
                            if (statement) {
                                logger.info(`[Pipeline] Successfully processed statement for ${att.filename}: ${statement.transactions.length} txns(${statement.bankName})`);

                                const stats = await this.deps.statementReconciler.reconcile(statement, userId);
                                logger.info(`[Pipeline] Reconciliation Stats: matched = ${stats.matched}, inserted = ${stats.newInserted} `);

                                // Mark that we successfully processed a statement
                                if (stats.matched > 0 || stats.newInserted > 0) {
                                    statementProcessedSuccessfully = true;
                                    logger.info(`[Pipeline] Statement processed successfully, will bypass broad detection`);
                                }
                            }
                        } catch (err) {
                            logger.warn(`[Pipeline] Failed to process attachment ${att.filename} `, err);
                        }
                    }
                }
                logger.debug(`[Pipeline] Stage 2.5(Attachments) took ${Date.now() - s2_5Start} ms`);
            }

            // ========================================
            // STAGE 3: BROAD DETECTION (Financial?)
            // Skip if we successfully processed a statement in Stage 2.5
            // ========================================
            const s3Start = Date.now();
            let isBroadFinancial = statementProcessedSuccessfully; // Auto-pass if statement was processed

            // NEW: Pre-classification check - trust high-confidence matches from verified banks
            // This prevents BroadDetector from rejecting valid transactions that the classifier already identified
            let preClassifyResult = null;
            if (!isBroadFinancial) {
                try {
                    preClassifyResult = this.deps.enhancedClassifier.classify(cleanEmail);
                    if (preClassifyResult &&
                        preClassifyResult.confidence >= 0.85 &&
                        preClassifyResult.type !== 'non_financial' &&
                        preClassifyResult.type !== 'unclassified' &&
                        preClassifyResult.metadata?.isFromKnownBank) {
                        // High confidence match from a verified bank sender - trust the classifier
                        isBroadFinancial = true;
                        logger.info(`[Pipeline] Stage 3: Bypassing BroadDetector due to pre-classification match: ${preClassifyResult.type} (${preClassifyResult.confidence.toFixed(2)}) from ${preClassifyResult.metadata?.bankName}`);
                    }
                } catch (err) {
                    // Pre-classify failed, continue with normal flow
                }
            }

            if (!isBroadFinancial && !statementProcessedSuccessfully) {
                const text = cleanEmail.subject + ' ' + cleanEmail.cleanedBody;
                isBroadFinancial = this.deps.broadDetector.isFinancialEmail(text);
            }
            logger.info(`[Pipeline] Stage 3(Broad Detection) took ${Date.now() - s3Start} ms.Result: ${isBroadFinancial ? 'PASS' : 'FAIL'}${statementProcessedSuccessfully ? ' (Statement bypass)' : ''} `);

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
                logger.info(`<< <[PIPELINE END] ${rawEmail.messageId} - Terminated(Non - Financial)`);
                return { status: 'terminated', reason: 'non_financial' };
            }

            // NEW: Exclusion Layer (Stage 2.5)
            const exclusionCheck = this.deps.enhancedClassifier.checkExclusions(cleanEmail);
            if (exclusionCheck.isExcluded) {
                await this.deps.terminator.terminate(
                    userId,
                    cleanEmail.id,
                    `Excluded by pattern: ${exclusionCheck.matchedPattern} `,
                    'stage_2_exclusion',
                    'NON_FINANCIAL',
                    jobId,
                    rawEmailId
                );
                logger.info(`<< <[PIPELINE END] ${rawEmail.messageId} - Terminated(Excluded: ${exclusionCheck.matchedPattern})`);
                return { status: 'terminated', reason: 'exclusion_match' };
            }

            // ========================================
            // STAGE 4: CLASSIFY TYPE (What kind?)
            // ========================================
            const s4Start = Date.now();
            let classificationResult = null;
            let classificationMethod = 'rule_based';
            let classificationStage = 'stage_4_rule_based';

            logger.info(`[Pipeline] Stage 4: Starting classification.cleanEmail.id = ${cleanEmail.id} `);

            // STEP 1: Try Enhanced Rule Classifier
            try {
                const enhancedResult = this.deps.enhancedClassifier.classify(cleanEmail);
                if (enhancedResult) {
                    if (enhancedResult.confidence >= 0.85 && enhancedResult.type !== 'non_financial' && enhancedResult.type !== 'unclassified') {
                        // High confidence rule match
                        classificationResult = enhancedResult;
                        classificationMethod = 'enhanced_rule';
                        logger.info(`[Pipeline] Enhanced Rule Match: ${enhancedResult.type} (${enhancedResult.confidence.toFixed(2)})`);
                    } else if (enhancedResult.type === 'non_financial') {
                        // Explicit non-financial match
                        await this.deps.terminator.terminate(
                            userId,
                            cleanEmail.id,
                            `Enhanced classifier: non - financial(${enhancedResult.metadata?.pattern})`,
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

            // STEP 2: GPT Fallback REMOVED
            // If rule-based classification failed or had low confidence, we now default to 'unclassified'
            // and rely on manual review or further pattern mining.
            const isLowConfidence = !classificationResult || (classificationResult.confidence < 0.85);

            if (isLowConfidence) {
                logger.info(`[Pipeline] Low confidence / No rule match. GPT Disabled. Defaulting to unclassified.`);

                // If we had a weak result, keep it but let it fail verification or be marked for review later?
                // Actually, if it's < 0.85, we treat it as unclassified usage for safety in this strict mode.
                // But strictly, if we matched a rule but it was weak (e.g. generic financial), maybe we keep it?
                // The current logic only sets classificationResult if >= 0.85. 
                // So classificationResult is likely null here.

                if (!classificationResult) {
                    classificationResult = {
                        type: 'unclassified',
                        confidence: 0,
                        metadata: { note: 'No rule matched (Strict Rule Mode)' }
                    };
                }
            }
            logger.info(`[Pipeline] Stage 4(Classify) took ${Date.now() - s4Start}ms via ${classificationMethod} `);
            console.log(`[PIPELINE] Classification: ${classificationResult?.type} (Confidence: ${classificationResult?.confidence}) Method: ${classificationMethod} `);

            // If verification failed or confidence is low, set needs_review
            if (!classificationResult || classificationResult.confidence < 0.75) {
                logger.warn(`[Pipeline] Low confidence(${classificationResult?.confidence || 0}), marking for review`);

                // Queue termination record (non-blocking)
                dbWriteQueueManager.enqueue('terminations', {
                    userId,
                    emailId: cleanEmail.id,
                    reason: `Low confidence classification: ${classificationResult?.confidence || 0}`,
                    stage: classificationStage,
                    type: 'LOW_CONFIDENCE',
                    scanJobId: jobId,
                    rawEmailId
                });

                // Queue unclassified transaction for review (non-blocking)
                dbWriteQueueManager.enqueue('transactions', {
                    id: crypto.randomUUID(),
                    userId,
                    transactionDate: new Date(rawEmail.internalDate),
                    merchant: cleanEmail.subject,
                    category: 'Unclassified',
                    amount: 0,
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

                logger.info(`<<<[PIPELINE END] ${rawEmail.messageId} - Needs Review`);
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
            logger.error(`[Pipeline] Fatal error processing email ${rawEmail.messageId}: `, {
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

            // Queue transaction write (non-blocking)
            dbWriteQueueManager.enqueue('transactions', {
                id: crypto.randomUUID(),
                userId,
                transactionDate: new Date(internalDate),
                merchant: subject,
                category: 'Unclassified',
                amount: 0,
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

            // Add to Manual Review Repository (keep sync for now - file operation is fast)
            void UnclassifiedRepository.add(cleanEmail, 'Unclassified');

            logger.info(`<<<[PIPELINE END] ${messageId} - Marked for Review(Unclassified)`);
            return { status: 'needs_review', reason: 'unclassified' };
        }

        try {
            logger.info(`[Pipeline] Stage 5: Starting extraction with ${classificationResult.type} extractor`);
            const Extractor = this.deps.extractorFactory.getExtractor(classificationResult.type as TransactionType);
            extracted = await Extractor.extract(userId, cleanEmail, classificationResult);

            // === ENRICHMENT ===
            try {
                // Enrich Merchant Name & Category
                const enriched = MerchantEnricher.enrich(extracted.merchant || '');

                // If we found a good match (confidence > 0.8), update the data
                // Or if the original was "Unknown Merchant" and we got something better
                if (enriched.confidence >= 0.8) {
                    logger.info(`[Pipeline] Enriched merchant: "${extracted.merchant}" -> "${enriched.canonicalName}"[${enriched.category}]`);
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

            logger.info(`[Pipeline] Stage 5(Extract) took ${Date.now() - s5Start} ms.Data: ${extracted.amount} ${extracted.currency} @${extracted.merchant} `);
        } catch (error) {
            logger.warn(`[Pipeline] Extraction failed via rules(${error instanceof Error ? error.message : String(error)}). Marking as Unclassified for Review.`);

            // Queue transaction write (non-blocking)
            dbWriteQueueManager.enqueue('transactions', {
                id: crypto.randomUUID(),
                userId,
                transactionDate: new Date(internalDate),
                merchant: subject,
                category: 'Unclassified',
                amount: 0,
                transactionType: 'unclassified',
                emailMessageId: cleanEmail.id,
                emailSubject: subject,
                emailSender: sender,
                classificationMethod: 'rule_failed',
                confidenceScore: 0,
                needsReview: true,
                reviewReason: `Extraction Failed: ${error instanceof Error ? error.message : String(error)}`,
                rawEmailId,
                scanJobId: jobId,
                rawExtraction: classificationResult
            });

            // Add to Manual Review Repository (fire-and-forget)
            void UnclassifiedRepository.add(cleanEmail, `Extraction Failed: ${classificationResult.type}`);

            logger.info(`<<<[PIPELINE END] ${messageId} - Marked for Review(Extraction Failed)`);
            return { status: 'needs_review', reason: 'extraction_failed', error: String(error) };
        }

        // ========================================
        // STAGE 6: PERSIST (Save to DB) - QUEUED, NON-BLOCKING
        // ========================================
        const s6Start = Date.now();

        // Generate transaction ID client-side for immediate return
        const transactionId = crypto.randomUUID();

        // Queue transaction write
        dbWriteQueueManager.enqueue('transactions', {
            id: transactionId,
            userId,
            instrumentType: extracted.instrumentType,
            instrumentId: extracted.instrumentId || null,
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

        // Queue scanned email update
        dbWriteQueueManager.enqueue('scanned_email_updates', {
            userId,
            messageId: cleanEmail.id,
            transactionId
        });

        logger.debug(`[Pipeline] Stage 6(Persist) queued in ${Date.now() - s6Start}ms`);
        logger.info(`<<<[PIPELINE END] ${messageId} - Total: ${Date.now() - startTime}ms Transaction: ${transactionId}`);
        console.log(`✅[PIPELINE SUCCESS] ${messageId} -> Transaction: ${transactionId}`);
        return { status: 'success', transactionId };
    }

    // processGptOnly method removed


    // classifyWithGPT method removed
}

// Default Singleton Instance
export const universalPipeline = new UniversalTransactionPipeline({
    sanitizer: SanitizerService,
    broadDetector: BroadFinancialDetector,
    terminator: TerminatorService,
    classifierRegistry: ClassifierRegistry,
    // gptClassifier removed
    enhancedClassifier: EnhancedRuleClassifier,
    extractorFactory: TransactionExtractorFactory,
    instrumentService: InstrumentService,
    manualReview: ManualReviewService,
    errorRecovery: ErrorRecoveryManager,
    statementParserFactory: StatementParserFactory,
    statementReconciler: StatementReconciler
});
