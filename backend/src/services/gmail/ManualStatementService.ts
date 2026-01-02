/**
 * Manual Statement Service
 * Handles processing of manually uploaded PDF statements
 * 
 * Extracted from GmailService as part of Issue #3 decomposition
 * 
 * Implementation for Issue #13.1:
 * - Integrates with StatementParserFactory for PDF parsing
 * - Uses BankPDFPasswordResolver for password-protected files
 * - Returns extracted transactions like other statement flows
 */

import logger from '../../utils/infrastructure/logger';
import { StatementParserFactory } from '../statements/StatementParserFactory';
import { StatementReconciler } from '../statements/StatementReconciler';
import { BankPDFPasswordResolver, PasswordContext } from '../statements/BankPDFPasswordResolver';
import { UserProfileService } from '../user/UserProfileService';
import { InstrumentRepository } from '../../repositories/InstrumentRepository';
import { ExtractedStatement, ReconciliationStats } from '../../types/statement.types';

export interface StatementData {
    cardId: string;
    statementMonth: number;
    statementYear: number;
    pdfBase64: string;
    password?: string;
}

export interface ManualStatementResult {
    status: 'success' | 'password_required' | 'unsupported_format' | 'error';
    message: string;
    cardId: string;
    statementMonth: number;
    statementYear: number;
    stats?: ReconciliationStats;
    statement?: ExtractedStatement;
}

export class ManualStatementService {
    /**
     * Process a manually uploaded statement PDF
     * 
     * Flow:
     * 1. Decode base64 PDF to buffer
     * 2. Build password candidates list (user-provided + auto-generated)
     * 3. Parse PDF using StatementParserFactory
     * 4. Reconcile extracted transactions with existing data
     * 5. Return result with stats
     */
    static async processStatement(userId: string, data: StatementData): Promise<ManualStatementResult> {
        const { cardId, statementMonth, statementYear, pdfBase64, password } = data;

        logger.info('[ManualStatementService] Processing manual statement', {
            userId,
            cardId,
            month: statementMonth,
            year: statementYear,
            hasPassword: !!password
        });

        try {
            // 1. Decode base64 PDF to buffer
            let pdfBuffer: Buffer;
            try {
                pdfBuffer = Buffer.from(pdfBase64, 'base64');

                // Basic validation: Check if buffer has content and starts with PDF magic bytes
                if (pdfBuffer.length < 5) {
                    throw new Error('PDF data is too small');
                }

                // PDF files should start with %PDF-
                const header = pdfBuffer.slice(0, 5).toString('ascii');
                if (header !== '%PDF-') {
                    logger.warn('[ManualStatementService] Invalid PDF header', { header: header.replace(/[^\x20-\x7E]/g, '?') });
                    // Don't fail immediately - some valid PDFs might have prefixed data
                }
            } catch (decodeError: any) {
                logger.error('[ManualStatementService] Failed to decode base64 PDF', { error: decodeError.message });
                return {
                    status: 'error',
                    message: 'Invalid PDF data: Could not decode the uploaded file. Please ensure it is a valid PDF.',
                    cardId,
                    statementMonth,
                    statementYear
                };
            }

            // 2. Build password candidates list
            const passwordCandidates = await this.buildPasswordCandidates(userId, password);

            logger.debug('[ManualStatementService] Password candidates generated', {
                count: passwordCandidates.length,
                hasUserPassword: !!password
            });

            // 3. Parse PDF using StatementParserFactory
            const statement = await StatementParserFactory.process(pdfBuffer, passwordCandidates);

            if (!statement) {
                // Determine if it's a password issue or format issue
                // If we had password candidates and it still failed, it might be incorrect passwords
                if (passwordCandidates.length > 0) {
                    logger.warn('[ManualStatementService] PDF parsing failed with passwords', {
                        userId,
                        cardId,
                        passwordCount: passwordCandidates.length
                    });

                    return {
                        status: 'password_required',
                        message: 'Could not unlock the PDF. The statement may be password-protected. Please provide the correct password.',
                        cardId,
                        statementMonth,
                        statementYear
                    };
                }

                logger.warn('[ManualStatementService] PDF format not supported or parsing failed', {
                    userId,
                    cardId
                });

                return {
                    status: 'unsupported_format',
                    message: 'Could not parse the statement. The bank format may not be supported yet, or the PDF may be corrupted.',
                    cardId,
                    statementMonth,
                    statementYear
                };
            }

            logger.info('[ManualStatementService] PDF parsed successfully', {
                bankName: statement.bankName,
                transactionCount: statement.transactions?.length || 0,
                accountNumber: statement.accountNumber
            });

            // 4. Reconcile transactions
            const stats = await StatementReconciler.reconcile(statement, userId);

            logger.info('[ManualStatementService] Reconciliation complete', {
                userId,
                cardId,
                ...stats
            });

            return {
                status: 'success',
                message: `Successfully processed ${stats.totalProcessed} transactions. ${stats.matched} matched, ${stats.newInserted} new.`,
                cardId,
                statementMonth,
                statementYear,
                stats,
                statement
            };

        } catch (error: any) {
            logger.error('[ManualStatementService] Error processing statement', {
                userId,
                cardId,
                error: error.message,
                stack: error.stack
            });

            return {
                status: 'error',
                message: `Failed to process statement: ${error.message}`,
                cardId,
                statementMonth,
                statementYear
            };
        }
    }

    /**
     * Build a list of password candidates for unlocking the PDF
     * 
     * Priority:
     * 1. User-provided password (if any)
     * 2. Auto-generated passwords using BankPDFPasswordResolver
     */
    private static async buildPasswordCandidates(userId: string, userPassword?: string): Promise<string[]> {
        const candidates: string[] = [];

        // User-provided password gets highest priority
        if (userPassword && userPassword.trim()) {
            candidates.push(userPassword.trim());
        }

        try {
            // Fetch user's instruments for password generation context
            const instruments = await InstrumentRepository.findByUserId(userId);

            // Fetch user profile context (Name, DOB)
            const profileContext = await UserProfileService.getPasswordContext(userId);

            // Build password context
            const context: PasswordContext = {
                firstName: profileContext?.firstName,
                dob: profileContext?.dob || undefined,
                instruments: instruments.map(inst => ({
                    ...inst,
                    // Map to the format expected by BankPDFPasswordResolver
                    account_number_masked: inst.last4 ? `XXXXXX${inst.last4}` : undefined
                })) as any
            };

            // Generate candidates using the resolver
            const generatedPasswords = BankPDFPasswordResolver.generateCandidates(context);

            // Add generated passwords that aren't already in the list
            for (const pwd of generatedPasswords) {
                if (!candidates.includes(pwd)) {
                    candidates.push(pwd);
                }
            }
        } catch (error: any) {
            logger.warn('[ManualStatementService] Failed to generate password candidates', {
                userId,
                error: error.message
            });
            // Continue with whatever candidates we have
        }

        return candidates;
    }
}
