import { SanitizerService } from '../sanitize/sanitizer';
import { FilterService } from '../filters/filterService';
import { TerminatorService } from '../terminator/terminator';
import { StatementExtractor } from '../extraction/statement.extractor';
import { TransactionExtractor } from '../extraction/transaction.extractor';
import { PdfParser } from '../extraction/pdfParser';
import pool from '../../lib/db';
import logger from '../../utils/logger';
import { gptQueue } from '../queue/gptQueue'; // Legacy queue for fallback
import { ResolutionService } from '../cards/resolution.service';
import * as transactionsService from '../transactions.service';
import { SimplifiedEmail } from '../../types';
import dayjs from 'dayjs';

interface PipelineStats {
    processed: number;
    success: number;
    terminated: number;
    failed: number;
    queuedGpt: number;
}

export class PipelineService {
    private static statementExtractor = new StatementExtractor();

    /**
     * Process a single email through the unified pipeline
     */
    static async processEmail(
        userId: string,
        rawEmail: SimplifiedEmail,
        jobId: string,
        fetchAttachmentFn: (msgId: string, attId: string) => Promise<Buffer | null>
    ): Promise<'success' | 'terminated' | 'queued_gpt' | 'failed'> {

        // 1. SAVE RAW (Audit Trail)
        // We do this first to ensure we have the record even if processing fails
        let rawEmailId: string;
        try {
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
            throw e; // Critical failure
        }

        try {
            // 2. SANITIZE
            // Clean HTML, extract clear body
            const cleanEmail = await SanitizerService.sanitize(rawEmail, fetchAttachmentFn);

            // 3. FILTER & CLASSIFY
            // Determine Intent: TRANSACTION, STATEMENT, or NON_FINANCIAL
            const filterResult = FilterService.filter(cleanEmail);

            logger.info(`[Pipeline] ${cleanEmail.id} -> ${filterResult.intent} (${filterResult.reason})`);

            // 4. ROUTE
            if (filterResult.intent === 'NON_FINANCIAL') {
                await TerminatorService.terminate(
                    userId,
                    cleanEmail.id,
                    filterResult.reason,
                    'filter',
                    filterResult.category,
                    jobId
                );
                return 'terminated';
            }

            if (filterResult.intent === 'CREDIT_CARD_STATEMENT') {
                return await this.processStatement(userId, cleanEmail, jobId, rawEmailId);
            }

            if (filterResult.intent === 'CREDIT_CARD_TRANSACTION') {
                return await this.processTransaction(userId, cleanEmail, jobId, rawEmailId);
            }

            return 'terminated'; // Default safe fallback

        } catch (error) {
            logger.error(`[Pipeline] Error processing ${rawEmail.messageId}`, error);
            // Log error to DB
            await pool.query(
                `INSERT INTO email_processing_log (user_id, email_message_id, processing_status, reason, stage, scan_job_id, created_at)
                 VALUES ($1, $2, 'failed', $3, 'pipeline', $4, NOW())
                 ON CONFLICT (email_message_id) DO UPDATE SET processing_status='failed'`,
                [userId, rawEmail.messageId, error instanceof Error ? error.message : String(error), jobId]
            );
            return 'failed';
        }
    }

    // --- SUB-PIPELINES ---

    private static async processStatement(
        userId: string,
        email: any,
        jobId: string,
        rawEmailId: string
    ): Promise<'success' | 'failed'> {
        const { StatementProcessor } = require('../extraction/statement');
        const { ResolutionService } = require('../cards/resolution.service');

        if (!email.attachments || email.attachments.length === 0) {
            logger.info(`[Pipeline] Statement ${email.id} has no attachments. Skipping.`);
            return 'success';
        }

        let extractedCount = 0;

        for (const att of email.attachments) {
            try {
                // Use StatementProcessor which handles PDF + Password + Extraction
                // We assume att.data is Buffer (Sanitizer provides it)
                const txns = await StatementProcessor.process(email, att.data);

                // Persist
                for (const txn of txns) {
                    await ResolutionService.resolveAndCreateTransaction(userId, {
                        ...txn,
                        date: txn.transactionDate,
                        extractionMethod: 'rule_based',
                        confidence: 0.9 // Statement confidence is high
                    }, {
                        id: email.id,
                        subject: email.subject,
                        body: email.cleanedBody,
                        from: email.from
                    }, { scanJobId: jobId, rawEmailId });
                    extractedCount++;
                }
            } catch (err) {
                logger.error(`[Pipeline] Statement Error on ${email.id}`, err);
            }
        }

        if (extractedCount > 0) {
            await pool.query(
                `INSERT INTO email_processing_log (user_id, email_message_id, processing_status, reason, stage, status_category, scan_job_id, created_at)
                 VALUES ($1, $2, 'success', $3, 'pdf_processing', 'STATEMENT', $4, NOW()) 
                 ON CONFLICT (email_message_id) DO UPDATE SET processing_status='success'`,
                [userId, email.id, `Extracted ${extractedCount} txns`, jobId]
            );
        }

        return 'success';
    }

    private static async processTransaction(
        userId: string,
        email: any,
        jobId: string,
        rawEmailId: string
    ): Promise<'success' | 'queued_gpt'> {

        // 1. Try Rule-Based Extraction
        const txn = await TransactionExtractor.extract(email);

        if (txn) {
            // Success! Save it.
            await ResolutionService.resolveAndCreateTransaction(userId, {
                ...txn,
                date: txn.transactionDate,
                extractionMethod: 'rule_based',
                confidence: txn.confidenceScore
            }, {
                id: email.id,
                subject: email.subject,
                body: email.cleanedBody,
                from: email.from
            }, { scanJobId: jobId, rawEmailId });

            await pool.query(
                `INSERT INTO email_processing_log (user_id, email_message_id, processing_status, reason, stage, status_category, scan_job_id, created_at)
                 VALUES ($1, $2, 'success', 'Rule-based success', 'rule_processing', 'TRANSACTION', $3, NOW()) 
                 ON CONFLICT (email_message_id) 
                 DO UPDATE SET processing_status='success', stage='rule_processing'`,
                [userId, email.id, jobId]
            );

            return 'success';
        } else {
            // 2. Fallback to GPT
            // Enqueue
            gptQueue.enqueue({
                ...email,
                userId: userId,
                scanJobId: jobId,
                rawEmailId: rawEmailId
            });
            return 'queued_gpt';
        }
    }

    private static inferBankFromSender(sender: string): string | null {
        // Simple helper, or reuse centralized one? 
        // For now, mapping inline to keep it self-contained or import from BankParsers? 
        // BankParsers has identifiers.
        // Let's iterate BankParsers
        const { BankParsers } = require('../extraction/bankParsers');
        const match = BankParsers.find((p: any) => p.identifiers.some((id: string) => sender.toLowerCase().includes(id)));
        return match ? match.bankName : null;
    }
}
