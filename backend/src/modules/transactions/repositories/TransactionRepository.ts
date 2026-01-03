/**
 * Transaction Repository
 * Pure data access layer for transactions
 * 
 * Extracted from TransactionService as part of Issue #4 CQRS-lite decomposition
 */

import { Transaction, TransactionFilters, TransactionMetadata } from '@shared/types/transaction.types';
import { PoolClient } from 'pg';
import pool, { query } from '@shared/database/db';
import { createHash } from 'crypto';

// Removing local TransactionRecord interface in favor of shared Transaction
// If local mapping is needed, we should be explicit.
// For now, aligning with existing pattern where services expect Transaction (snake_case)


export class TransactionRepository {
    private static getRunner(client?: PoolClient) {
        return client ? client.query.bind(client) : query;
    }

    /**
     * Find transaction by ID
     */
    static async findById(userId: string, transactionId: string, client?: PoolClient): Promise<Transaction | null> {
        const runQuery = this.getRunner(client);
        const result = await runQuery(
            `SELECT * FROM transactions WHERE id = $1 AND user_id = $2`,
            [transactionId, userId]
        );
        return result.rows[0] || null;
    }

    /**
     * Find user ID by transaction ID (system lookup)
     */
    static async findUserIdByTransactionId(transactionId: string): Promise<{ userId: string; status: string } | null> {
        const result = await query(
            `SELECT user_id, transaction_status FROM transactions WHERE id = $1`,
            [transactionId]
        );
        if (result.rows.length === 0) return null;
        return {
            userId: result.rows[0].user_id,
            status: result.rows[0].transaction_status
        };
    }

    /**
     * Find transaction by fingerprint (for deduplication)
     */
    static async findByFingerprint(userId: string, fingerprint: string, client?: PoolClient): Promise<Transaction | null> {
        const runQuery = this.getRunner(client);
        const result = await runQuery(
            `SELECT * FROM transactions WHERE user_id = $1 AND txn_fingerprint = $2`,
            [userId, fingerprint]
        );
        return result.rows[0] || null;
    }

    /**
     * Find transaction by external references (RRN, ARN, etc)
     */
    static async findByReference(
        userId: string,
        refs: { rrn?: string; arn?: string; upiRef?: string; impsRef?: string },
        client?: PoolClient
    ): Promise<Transaction | null> {
        const runQuery = this.getRunner(client);

        const conditions: string[] = [];
        const params: any[] = [userId];
        let pIdx = 2;

        if (refs.rrn) {
            conditions.push(`rrn = $${pIdx++}`);
            params.push(refs.rrn);
        }
        if (refs.arn) {
            conditions.push(`arn = $${pIdx++}`);
            params.push(refs.arn);
        }
        if (refs.upiRef) {
            conditions.push(`upi_ref = $${pIdx++}`);
            params.push(refs.upiRef);
        }
        if (refs.impsRef) {
            conditions.push(`imps_ref = $${pIdx++}`);
            params.push(refs.impsRef);
        }

        if (conditions.length === 0) return null;

        const whereClause = conditions.join(' OR ');
        const result = await runQuery(
            `SELECT * FROM transactions WHERE user_id = $1 AND (${whereClause}) LIMIT 1`,
            params
        );
        return result.rows[0] || null;
    }

    /**
     * Check which fingerprints already exist
     */
    static async getExistingFingerprints(userId: string, fingerprints: string[], client?: PoolClient): Promise<string[]> {
        if (fingerprints.length === 0) return [];
        const runQuery = this.getRunner(client);
        const result = await runQuery(
            `SELECT txn_fingerprint FROM transactions 
             WHERE user_id = $1 AND txn_fingerprint = ANY($2)`,
            [userId, fingerprints]
        );
        return result.rows.map(r => r.txn_fingerprint);
    }

    /**
     * Create a transaction
     */

    static async create(data: {
        userId: string;
        instrumentType: string;
        instrumentId?: string;
        transactionDate: Date;
        merchant: string;
        category: string;
        amount: number;
        direction: 'credit' | 'debit';
        billMonth: number;
        billYear: number;
        description?: string;
        emailMessageId?: string;
        txnFingerprint?: string;
        isManuallyAdded?: boolean;
        metadata?: any;
        classificationMethod?: string;
        parentTransactionId?: string;
        transactionType?: string;
        // Extended fields
        emailSubject?: string;
        emailSender?: string;
        exactTimestamp?: Date;
        gmailThreadId?: string;
        gmailAccountIndex?: number;
        currencyCode?: string;
        originalAmount?: number;
        transactionSubtype?: string;
        scanJobId?: string;
        rawEmailId?: string;
        rawExtraction?: any;
        referenceNumber?: string;
        originalCurrency?: string;
        exchangeRate?: number;
        conversionSkipped?: boolean;
    }, client?: PoolClient): Promise<Transaction> {
        const runQuery = this.getRunner(client);
        const result = await runQuery(
            `INSERT INTO transactions (
                user_id, instrument_type, instrument_id, transaction_date, merchant, category,
                amount, direction, bill_month, bill_year, description, email_message_id,
                txn_fingerprint, is_manually_added, metadata, classification_method, parent_transaction_id, transaction_type,
                email_subject, email_sender, exact_timestamp, gmail_thread_id, gmail_account_index,
                currency_code, original_amount, transaction_subtype, scan_job_id, raw_email_id,
                raw_extraction, reference_number, original_currency, exchange_rate, conversion_skipped
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
            RETURNING *`,
            [
                data.userId, data.instrumentType, data.instrumentId, data.transactionDate,
                data.merchant, data.category, data.amount, data.direction, data.billMonth,
                data.billYear, data.description, data.emailMessageId, data.txnFingerprint,
                data.isManuallyAdded ?? false, data.metadata ? JSON.stringify(data.metadata) : null,
                data.classificationMethod ?? 'manual', data.parentTransactionId, data.transactionType,
                data.emailSubject, data.emailSender, data.exactTimestamp, data.gmailThreadId, data.gmailAccountIndex,
                data.currencyCode, data.originalAmount, data.transactionSubtype, data.scanJobId, data.rawEmailId,
                data.rawExtraction ? JSON.stringify(data.rawExtraction) : null, data.referenceNumber,
                data.originalCurrency, data.exchangeRate, data.conversionSkipped
            ]
        );
        return result.rows[0];
    }

    /**
     * Update a transaction
     */
    static async update(userId: string, transactionId: string, data: Partial<{
        merchant: string;
        category: string;
        amount: number;
        description: string | null;
        needsReview: boolean;
        reviewReason: string | null;
        isSplit: boolean;
        isSettled: boolean; // Added
    }>, client?: PoolClient): Promise<Transaction | null> {
        const sets: string[] = [];
        const params: any[] = [transactionId, userId];
        let idx = 3;

        if (data.merchant !== undefined) { sets.push(`merchant = $${idx++}`); params.push(data.merchant); }
        if (data.category !== undefined) { sets.push(`category = $${idx++}`); params.push(data.category); }
        if (data.amount !== undefined) { sets.push(`amount = $${idx++}`); params.push(data.amount); }
        if (data.description !== undefined) { sets.push(`description = $${idx++}`); params.push(data.description); }
        if (data.needsReview !== undefined) { sets.push(`needs_review = $${idx++}`); params.push(data.needsReview); }
        if (data.reviewReason !== undefined) { sets.push(`review_reason = $${idx++}`); params.push(data.reviewReason); }
        if (data.isSplit !== undefined) { sets.push(`is_split = $${idx++}`); params.push(data.isSplit); }

        if (sets.length === 0) return null;
        sets.push(`updated_at = NOW()`);

        const runQuery = this.getRunner(client);
        const result = await runQuery(
            `UPDATE transactions SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
            params
        );
        return result.rows[0] || null;
    }

    /**
     * Delete a transaction
     */
    static async delete(userId: string, transactionId: string, client?: PoolClient): Promise<boolean> {
        const runQuery = this.getRunner(client);
        const result = await runQuery(
            `DELETE FROM transactions WHERE id = $1 AND user_id = $2`,
            [transactionId, userId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Mark transaction as split
     * type: deprecated - use update
     */
    static async markAsSplit(transactionId: string, client?: PoolClient): Promise<void> {
        const runQuery = this.getRunner(client);
        await runQuery(`UPDATE transactions SET is_split = true WHERE id = $1`, [transactionId]);
    }

    /**
     * Create split child transaction
     */
    static async createSplitChild(data: {
        userId: string;
        parentTransactionId: string;
        instrumentId: string;
        instrumentType: string;
        transactionDate: Date;
        amount: number;
        currencyCode: string;
        direction: string;
        merchant: string;
        category: string;
        description?: string;
        splitIndex: number;
        billMonth: number;
        billYear: number;
    }, client?: PoolClient): Promise<void> {
        const runQuery = this.getRunner(client);
        await runQuery(
            `INSERT INTO transactions (
                user_id, instrument_id, instrument_type, transaction_date, 
                amount, currency_code, direction, 
                merchant, category, description, 
                parent_transaction_id, split_index,
                bill_month, bill_year, is_manually_added
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)`,
            [
                data.userId, data.instrumentId, data.instrumentType, data.transactionDate,
                data.amount, data.currencyCode, data.direction,
                data.merchant, data.category, data.description,
                data.parentTransactionId, data.splitIndex,
                data.billMonth, data.billYear,
            ]
        );
    }

    /**
     * Link refund to original
     */
    static async linkRefund(userId: string, refundId: string, originalId: string, client?: PoolClient): Promise<boolean> {
        const runQuery = this.getRunner(client);
        const result = await runQuery(
            `UPDATE transactions 
             SET linked_transaction_id = $1, link_type = 'refund', is_reversal = true
             WHERE id = $2 AND user_id = $3
             RETURNING id`,
            [originalId, refundId, userId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Find exact duplicate (for imports)
     */
    static async findExactDuplicate(
        userId: string,
        instrumentId: string,
        amount: number,
        date: string | Date,
        description: string,
        client?: PoolClient
    ): Promise<string | null> {
        const runQuery = this.getRunner(client);
        const result = await runQuery(
            `SELECT id FROM transactions 
             WHERE user_id = $1 AND instrument_id = $2 
             AND amount = $3 AND transaction_date = $4
             AND description = $5 LIMIT 1`,
            [userId, instrumentId, amount, date, description]
        );
        return result.rows[0]?.id || null;
    }

    /**
     * Generate fingerprint for deduplication
     */
    static generateFingerprint(emailMessageId: string, transactionDate: Date, amount: number, merchant: string): string {
        const data = `${emailMessageId}-${transactionDate.toISOString()}-${amount}-${merchant}`;
        return createHash('sha256').update(data).digest('hex');
    }

    // ==========================================
    // Lifecycle & Analysis Methods
    // ==========================================

    static async updateStatus(
        userId: string,
        transactionId: string,
        newStatus: string,
        client?: PoolClient
    ): Promise<void> {
        const runQuery = this.getRunner(client);
        await runQuery(
            `UPDATE transactions 
             SET transaction_status = $1, updated_at = NOW()
             WHERE id = $2 AND user_id = $3`,
            [newStatus, transactionId, userId]
        );
    }

    static async getStatus(userId: string, transactionId: string): Promise<string | null> {
        const result = await query(
            `SELECT transaction_status FROM transactions WHERE id = $1 AND user_id = $2`,
            [transactionId, userId]
        );
        return result.rows[0]?.transaction_status || null;
    }

    static async markDisputed(userId: string, transactionId: string, reason: string): Promise<boolean> {
        const result = await query(
            `UPDATE transactions 
             SET dispute_flag = TRUE,
                 review_reason = COALESCE($1, review_reason, 'Disputed by user'),
                 needs_review = TRUE,
                 updated_at = NOW()
             WHERE id = $2 AND user_id = $3`,
            [reason, transactionId, userId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    static async markChargeback(userId: string, transactionId: string): Promise<boolean> {
        const result = await query(
            `UPDATE transactions 
             SET chargeback_flag = TRUE,
                 dispute_flag = TRUE,
                 updated_at = NOW()
             WHERE id = $2 AND user_id = $3`,
            [transactionId, userId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    static async detectRecurring(userId: string): Promise<number> {
        const result = await query(
            `WITH recurring_candidates AS (
                SELECT 
                    merchant,
                    amount,
                    COUNT(*) as occurrence_count,
                    ARRAY_AGG(id) as transaction_ids
                FROM transactions
                WHERE user_id = $1
                  AND transaction_date > NOW() - INTERVAL '6 months'
                  AND is_recurring = FALSE
                GROUP BY merchant, amount
                HAVING COUNT(*) >= 2
            )
            UPDATE transactions t
            SET is_recurring = TRUE, updated_at = NOW()
            FROM recurring_candidates rc
            WHERE t.id = ANY(rc.transaction_ids)
              AND t.is_recurring = FALSE
            RETURNING t.id`,
            [userId]
        );
        return result.rows.length;
    }

    static async detectReversals(userId: string): Promise<number> {
        const result = await query(
            `UPDATE transactions credit_txn
             SET is_reversal = TRUE,
                 linked_transaction_id = debit_txn.id,
                 link_type = 'reversal',
                 updated_at = NOW()
             FROM transactions debit_txn
             WHERE credit_txn.user_id = $1
               AND debit_txn.user_id = $1
               AND credit_txn.direction = 'credit'
               AND debit_txn.direction = 'debit'
               AND credit_txn.amount = debit_txn.amount
               AND LOWER(TRIM(credit_txn.merchant)) = LOWER(TRIM(debit_txn.merchant))
               AND credit_txn.transaction_date > debit_txn.transaction_date
               AND credit_txn.transaction_date < debit_txn.transaction_date + INTERVAL '30 days'
               AND credit_txn.is_reversal = FALSE
               AND credit_txn.linked_transaction_id IS NULL
             RETURNING credit_txn.id`,
            [userId]
        );
        return result.rows.length;
    }

    static async getPendingOlderThan(userId: string, daysOld: number): Promise<string[]> {
        const result = await query(
            `SELECT id FROM transactions
             WHERE user_id = $1
               AND transaction_status = 'pending'
               AND transaction_date < NOW() - INTERVAL '${daysOld} days'`,
            [userId]
        );
        return result.rows.map(r => r.id);
    }

    static async autoPostPending(userId: string, daysThreshold: number): Promise<number> {
        const result = await query(
            `UPDATE transactions
             SET transaction_status = 'posted',
                 is_provisional = FALSE,
                 updated_at = NOW()
             WHERE user_id = $1
               AND transaction_status = 'pending'
               AND transaction_date < NOW() - INTERVAL '${daysThreshold} days'
             RETURNING id`,
            [userId]
        );
        return result.rows.length;
    }

    // ==========================================
    // Deduplication & Linking Support
    // ==========================================

    static async findPotentialDuplicates(
        userId: string,
        amountMin: number,
        amountMax: number,
        dateStart: Date,
        dateEnd: Date
    ): Promise<Transaction[]> {
        const result = await query(
            `SELECT * FROM transactions 
             WHERE user_id = $1 
               AND amount BETWEEN $2 AND $3
               AND transaction_date BETWEEN $4 AND $5
             LIMIT 5`,
            [userId, amountMin, amountMax, dateStart, dateEnd]
        );
        return result.rows;
    }

    static async getFingerprintCandidates(userId: string, batchSize: number): Promise<Transaction[]> {
        const result = await query(
            `SELECT * FROM transactions 
             WHERE user_id = $1 AND (txn_fingerprint IS NULL OR txn_fingerprint = '')
             LIMIT $2`,
            [userId, batchSize]
        );
        return result.rows;
    }

    static async updateFingerprint(id: string, fingerprint: string): Promise<void> {
        await query(
            `UPDATE transactions SET txn_fingerprint = $1 WHERE id = $2`,
            [fingerprint, id]
        );
    }

    static async findPotentialRefunds(
        userId: string,
        amount: number,
        windowStart: Date,
        windowEnd: Date
    ): Promise<Transaction[]> {
        const result = await query(
            `SELECT * FROM transactions
             WHERE user_id = $1
               AND amount = $2
               AND direction = 'debit'
               AND transaction_date BETWEEN $3 AND $4
               AND linked_transaction_id IS NULL
             ORDER BY transaction_date DESC
             LIMIT 5`,
            [userId, amount, windowStart, windowEnd]
        );
        return result.rows;
    }

    static async findPotentialAuths(
        userId: string,
        amountMin: number,
        amountMax: number,
        windowStart: Date,
        windowEnd: Date
    ): Promise<Transaction[]> {
        const result = await query(
            `SELECT * FROM transactions
             WHERE user_id = $1
               AND amount BETWEEN $2 AND $3
               AND direction = 'debit'
               AND transaction_date BETWEEN $4 AND $5
               AND (is_provisional = TRUE OR transaction_status = 'pending')
             ORDER BY transaction_date DESC
             LIMIT 5`,
            [userId, amountMin, amountMax, windowStart, windowEnd]
        );
        return result.rows;
    }

    static async linkTransaction(
        transactionId: string,
        linkedTransactionId: string,
        linkType: string
    ): Promise<boolean> {
        const result = await query(
            `UPDATE transactions 
             SET linked_transaction_id = $1, link_type = $2, updated_at = NOW()
             WHERE id = $3`,
            [linkedTransactionId, linkType, transactionId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    static async getRefundingTransactions(userId: string, originalTransactionId: string): Promise<Transaction[]> {
        const result = await query(
            `SELECT * FROM transactions
             WHERE user_id = $1
               AND linked_transaction_id = $2
               AND link_type IN ('refund', 'partial_refund')`,
            [userId, originalTransactionId]
        );
        return result.rows;
    }

    static async findDuplicateClusters(userId: string, windowDays: number): Promise<any[]> {
        const result = await query(
            `SELECT amount, merchant, 
                    ARRAY_AGG(id) as ids,
                    ARRAY_AGG(transaction_date) as dates
             FROM transactions
             WHERE user_id = $1
               AND transaction_date > NOW() - INTERVAL '${windowDays} days'
             GROUP BY amount, LOWER(TRIM(merchant))
             HAVING COUNT(*) > 1
             ORDER BY COUNT(*) DESC
             LIMIT 50`,
            [userId]
        );
        return result.rows.map(row => ({
            amount: parseFloat(row.amount),
            merchant: row.merchant,
            transactionIds: row.ids,
            dates: row.dates
        }));
    }
    // ==========================================
    // Reconciliation Support
    // ==========================================

    static async getBalanceStats(userId: string, accountId: string, date: Date, client?: PoolClient) {
        const runQuery = this.getRunner(client);
        const result = await runQuery(
            `SELECT 
                SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) as total_credits,
                SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) as total_debits,
                COUNT(*) as tx_count
             FROM transactions 
             WHERE user_id = $1 
               AND instrument_id = $2 
               AND transaction_date <= $3
               AND (is_split IS NULL OR is_split = false)
               AND is_reconciled = false
               AND (transaction_status IS NULL OR transaction_status != 'pending')`,
            [userId, accountId, date]
        );
        return {
            totalCredits: parseFloat(result.rows[0].total_credits || '0'),
            totalDebits: parseFloat(result.rows[0].total_debits || '0'),
            txCount: parseInt(result.rows[0].tx_count || '0')
        };
    }

    static async markReconciled(userId: string, accountId: string, date: Date, client?: PoolClient): Promise<void> {
        const runQuery = this.getRunner(client);
        await runQuery(
            `UPDATE transactions 
             SET is_reconciled = true 
             WHERE user_id = $1 
               AND instrument_id = $2 
               AND transaction_date <= $3
               AND (transaction_status IS NULL OR transaction_status != 'pending')`,
            [userId, accountId, date]
        );
    }

    static async batchCreate(transactions: Array<{
        id?: string;
        userId: string;
        instrumentType: string | null;
        instrumentId?: string;
        transactionDate: Date;
        merchant: string;
        category: string;
        amount: number;
        transactionType: string;
        direction: 'credit' | 'debit';
        counterpartyName?: string;
        counterpartyIdentifier?: string;
        referenceNumber?: string;
        description?: string;
        billMonth?: number;
        billYear?: number;
        emailMessageId?: string;
        emailSubject?: string;
        emailSender?: string;
        txnFingerprint?: string;
        isManuallyAdded: boolean;
        metadata?: any;
        rawExtraction?: any;
        classificationMethod?: string;
        confidenceScore?: number;
        needsReview?: boolean;
        reviewReason?: string;
        exactTimestamp?: Date;
        gmailThreadId?: string;
        gmailAccountIndex?: number;
        currencyCode?: string;
        originalAmount?: number;
        transactionSubtype?: string;
        scanJobId?: string;
        rawEmailId?: string;
        trustScore?: number;
        originalCurrency?: string;
        exchangeRate?: number;
        conversionSkipped?: boolean;
    }>): Promise<void> {
        if (transactions.length === 0) return;

        // Prepare arrays for UNNEST
        const ids: string[] = [];
        const userIds: string[] = [];
        const instrumentTypes: (string | null)[] = [];
        const instrumentIds: (string | null)[] = [];
        const transactionDates: Date[] = [];
        const merchants: string[] = [];
        const categories: string[] = [];
        const amounts: number[] = [];
        const transactionTypes: string[] = [];
        const directions: (string | null)[] = [];
        const counterpartyNames: (string | null)[] = [];
        const counterpartyIdentifiers: (string | null)[] = [];
        const referenceNumbers: (string | null)[] = [];
        const descriptions: (string | null)[] = [];
        const billMonths: (number | null)[] = [];
        const billYears: (number | null)[] = [];
        const emailMessageIds: (string | null)[] = [];
        const emailSubjects: (string | null)[] = [];
        const emailSenders: (string | null)[] = [];
        const txnFingerprints: (string | null)[] = [];
        const isManuallyAddeds: boolean[] = [];
        const metadatas: (string | null)[] = [];
        const rawExtractions: (string | null)[] = [];
        const classificationMethods: (string | null)[] = [];
        const confidenceScores: (number | null)[] = [];
        const needsReviews: boolean[] = [];
        const reviewReasons: (string | null)[] = [];
        const exactTimestamps: (Date | null)[] = [];
        const gmailThreadIds: (string | null)[] = [];
        const gmailAccountIndices: number[] = [];
        const currencyCodes: (string | null)[] = [];
        const originalAmounts: (number | null)[] = [];
        const transactionSubtypes: (string | null)[] = [];
        const scanJobIds: (string | null)[] = [];
        const originalCurrencies: (string | null)[] = [];
        const exchangeRates: (number | null)[] = [];
        const conversionSkippeds: boolean[] = [];

        const rawEmailIds: (string | null)[] = [];
        const trustScores: (number | null)[] = [];

        // Import randomUUID dynamically
        const { randomUUID } = require('crypto');

        for (const data of transactions) {
            ids.push(data.id || randomUUID());
            userIds.push(data.userId);

            instrumentTypes.push(data.instrumentType || null);
            instrumentIds.push(data.instrumentId || null);

            transactionDates.push(data.transactionDate);
            merchants.push(data.merchant?.substring(0, 255) || '');
            categories.push(data.category?.substring(0, 100) || '');
            amounts.push(data.amount);
            transactionTypes.push(data.transactionType);

            directions.push(data.direction || null);
            counterpartyNames.push(data.counterpartyName || null);
            counterpartyIdentifiers.push(data.counterpartyIdentifier || null);
            referenceNumbers.push(data.referenceNumber?.substring(0, 100) || null);
            descriptions.push(data.description || null);

            billMonths.push(data.billMonth || null);
            billYears.push(data.billYear || null);

            emailMessageIds.push(data.emailMessageId?.substring(0, 255) || null);
            emailSubjects.push(data.emailSubject?.substring(0, 500) || null);
            emailSenders.push(data.emailSender || null);
            txnFingerprints.push(data.txnFingerprint || null);

            isManuallyAddeds.push(data.isManuallyAdded || false);

            metadatas.push(data.metadata ? JSON.stringify(data.metadata) : null);
            rawExtractions.push(data.rawExtraction ? JSON.stringify(data.rawExtraction) : null);

            classificationMethods.push(data.classificationMethod || null);
            confidenceScores.push(data.confidenceScore || null);
            needsReviews.push(data.needsReview || false);
            reviewReasons.push(data.reviewReason || null);

            exactTimestamps.push(data.exactTimestamp || null);
            gmailThreadIds.push(data.gmailThreadId || null);
            gmailAccountIndices.push(data.gmailAccountIndex !== undefined ? data.gmailAccountIndex : -1);
            currencyCodes.push(data.currencyCode || null);
            originalAmounts.push(data.originalAmount || null);
            transactionSubtypes.push(data.transactionSubtype || null);
            scanJobIds.push(data.scanJobId || null);
            rawEmailIds.push(data.rawEmailId || null);
            trustScores.push(data.trustScore !== undefined ? data.trustScore : null);
            originalCurrencies.push(data.originalCurrency || null);
            exchangeRates.push(data.exchangeRate || null);
            conversionSkippeds.push(data.conversionSkipped || false);
        }

        await query(
            `INSERT INTO transactions (
            id, user_id, instrument_type, instrument_id,
            transaction_date, merchant, category, amount, transaction_type,
            direction, counterparty_name, counterparty_identifier, reference_number, description,
            bill_month, bill_year,
            email_message_id, email_subject, email_sender,
            txn_fingerprint, is_manually_added, metadata,
            raw_extraction, classification_method, confidence_score,
            needs_review, review_reason,
            exact_timestamp, gmail_thread_id, gmail_account_index,
            currency_code, original_amount, transaction_subtype,
            scan_job_id, raw_email_id, trust_score,
            original_currency, exchange_rate, conversion_skipped,
            created_at, updated_at
        )
        SELECT *, NOW(), NOW() FROM UNNEST(
            $1::uuid[], $2::uuid[], $3::text[], $4::uuid[],
            $5::timestamp[], $6::text[], $7::text[], $8::numeric[], $9::text[],
            $10::text[], $11::text[], $12::text[], $13::text[], $14::text[],
            $15::integer[], $16::integer[],
            $17::text[], $18::text[], $19::text[],
            $20::text[], $21::boolean[], $22::jsonb[],
            $23::jsonb[], $24::text[], $25::numeric[],
            $26::boolean[], $27::text[],
            $28::timestamp[], $29::text[], $30::integer[],
            $31::text[], $32::numeric[], $33::text[],
            $34::uuid[], $35::uuid[], $36::integer[],
            $37::text[], $38::numeric[], $39::boolean[]
        )
        ON CONFLICT (email_message_id, txn_fingerprint) DO NOTHING`,
            [
                ids, userIds, instrumentTypes, instrumentIds,
                transactionDates, merchants, categories, amounts, transactionTypes,
                directions, counterpartyNames, counterpartyIdentifiers, referenceNumbers, descriptions,
                billMonths, billYears,
                emailMessageIds, emailSubjects, emailSenders,
                txnFingerprints, isManuallyAddeds, metadatas,
                rawExtractions, classificationMethods, confidenceScores,
                needsReviews, reviewReasons,
                exactTimestamps, gmailThreadIds, gmailAccountIndices,
                currencyCodes, originalAmounts, transactionSubtypes,
                scanJobIds, rawEmailIds, trustScores,
                originalCurrencies, exchangeRates, conversionSkippeds
            ]
        );
    }
    /**
     * Find transaction aggregates for bill generation
     */
    static async findBillableAggregates(userId: string): Promise<any[]> {
        const result = await query(
            `WITH transaction_aggregates AS (
        SELECT 
          t.instrument_id,
          t.bill_month,
          t.bill_year,
          SUM(CASE WHEN t.direction = 'debit' THEN t.amount ELSE 0 END) as total_debits,
          SUM(CASE WHEN t.direction = 'credit' THEN t.amount ELSE 0 END) as total_credits,
          COUNT(*) as transaction_count
        FROM transactions t
        INNER JOIN instruments i ON t.instrument_id = i.id
        WHERE t.user_id = $1 
          AND t.instrument_id IS NOT NULL
          AND t.bill_month IS NOT NULL
          AND t.bill_year IS NOT NULL
          AND i.type = 'credit_card'
        GROUP BY t.instrument_id, t.bill_month, t.bill_year
        HAVING SUM(CASE WHEN t.direction = 'debit' THEN t.amount ELSE 0 END) > 0
      )
      SELECT ta.*, 
        COALESCE((i.metadata->>'bill_date')::int, 1) as bill_date,
        COALESCE((i.metadata->>'due_date')::int, 15) as due_date
      FROM transaction_aggregates ta
      INNER JOIN instruments i ON ta.instrument_id = i.id
      WHERE NOT EXISTS (
        SELECT 1 FROM bill_payments bp 
        WHERE bp.instrument_id = ta.instrument_id 
          AND bp.bill_month = ta.bill_month 
          AND bp.bill_year = ta.bill_year
      )`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Find unmapped transaction subtotals for instrument suggestion
     */
    static async findUnmappedSubtotals(userId: string): Promise<any[]> {
        const result = await query(
            `SELECT DISTINCT
        t.metadata->>'bankName' as bank_name,
        t.metadata->>'last4' as last4,
        t.instrument_type,
        COUNT(*) as transaction_count,
        SUM(t.amount) as total_amount
      FROM transactions t
      WHERE t.user_id = $1 
        AND t.instrument_id IS NULL
        AND t.metadata->>'last4' IS NOT NULL
        AND t.metadata->>'bankName' IS NOT NULL
      GROUP BY t.metadata->>'bankName', t.metadata->>'last4', t.instrument_type
      HAVING COUNT(*) >= 2`,
            [userId]
        );
        return result.rows;
    }
    /**
     * Get historical spending stats by category
     */
    static async getCategorySpendingHistory(userId: string, months: number): Promise<Array<{ category: string; averageAmount: number }>> {
        const result = await query(
            `SELECT 
                category,
                SUM(amount) / $2 as avg_amount
             FROM transactions
             WHERE user_id = $1
               AND transaction_date >= NOW() - ($2 || ' months')::INTERVAL
               AND direction = 'debit'
               AND category IS NOT NULL
               AND category != 'Transfer'
               AND category != 'Payment'
             GROUP BY category
             HAVING SUM(amount) > 0`,
            [userId, months]
        );

        return result.rows.map(row => ({
            category: row.category,
            averageAmount: parseFloat(row.avg_amount)
        }));
    }

    /**
     * Find merchant stats for rule suggestions
     */
    static async findCategoryConsistencyStats(userId: string): Promise<any[]> {
        const result = await query(
            `WITH MerchantStats AS (
         SELECT 
           merchant,
           category,
           COUNT(*) as count,
           MAX(id) as sample_id
         FROM transactions
         WHERE user_id = $1 
           AND category IS NOT NULL 
           AND category != 'Uncategorized'
           AND merchant IS NOT NULL
           AND is_manually_added = false
         GROUP BY merchant, category
       ),
       MerchantTotals AS (
         SELECT 
           merchant,
           SUM(count) as total_txns
         FROM MerchantStats
         GROUP BY merchant
       )
       SELECT 
         ms.merchant,
         ms.category,
         ms.count,
         mt.total_txns,
         ms.sample_id,
         (ms.count::DECIMAL / mt.total_txns) as ratio
       FROM MerchantStats ms
       JOIN MerchantTotals mt ON ms.merchant = mt.merchant
       WHERE mt.total_txns >= 3
         AND (ms.count::DECIMAL / mt.total_txns) >= 0.8
       ORDER BY mt.total_txns DESC, ratio DESC
       LIMIT 10`,
            [userId]
        );
        return result.rows;
    }
    /**
     * Get monthly summary (income, expenses, count)
     */
    static async getMonthlySummary(userId: string, startDate: string, endDate: string): Promise<{ income: number; expenses: number; transaction_count: number }> {
        const result = await query(
            `SELECT 
            COALESCE(SUM(CASE WHEN direction = 'credit' AND category != 'Transfer' THEN amount ELSE 0 END), 0) as income,
            COALESCE(SUM(CASE WHEN direction = 'debit' AND category != 'Transfer' THEN amount ELSE 0 END), 0) as expenses,
            COUNT(DISTINCT id) as transaction_count
           FROM transactions 
           WHERE user_id = $1 
           AND transaction_date BETWEEN $2 AND $3
           AND is_transfer IS NOT TRUE`,
            [userId, startDate, endDate]
        );
        const row = result.rows[0];
        return {
            income: parseFloat(row.income),
            expenses: parseFloat(row.expenses),
            transaction_count: parseInt(row.transaction_count)
        };
    }

    /**
     * Get category breakdown for a period
     */
    static async getCategoryBreakdown(userId: string, startDate: string, endDate: string): Promise<Array<{ category: string; total: number; count: number }>> {
        const result = await query(
            `SELECT category, 
            SUM(amount) as total,
            COUNT(*) as count
           FROM transactions 
           WHERE user_id = $1 
           AND transaction_date BETWEEN $2 AND $3
           AND direction = 'debit'
           AND is_transfer IS NOT TRUE
           GROUP BY category
           ORDER BY total DESC`,
            [userId, startDate, endDate]
        );
        return result.rows.map(row => ({
            category: row.category,
            total: parseFloat(row.total),
            count: parseInt(row.count)
        }));
    }
    /**
     * Get current month spending (Specific for Budget Service)
     */
    static async getCurrentMonthSpending(userId: string, month: number, year: number): Promise<number> {
        const result = await query(
            `SELECT COALESCE(SUM(amount), 0) as spent
             FROM transactions
             WHERE user_id = $1
               AND EXTRACT(MONTH FROM transaction_date) = $2
               AND EXTRACT(YEAR FROM transaction_date) = $3
               AND direction = 'debit'
               AND (is_transfer IS NULL OR is_transfer = false)`,
            [userId, month, year]
        );
        return parseFloat(result.rows[0].spent);
    }
    /**
     * List transactions with filters
     */
    static async list(
        userId: string,
        filters: TransactionFilters & { sortBy?: string; sortOrder?: 'asc' | 'desc' }
    ): Promise<{ data: Transaction[]; total: number }> {
        const safeFilters = filters ?? {};

        const where: string[] = ['t.user_id = $1'];
        const params: any[] = [userId];
        let paramIndex = 2;

        if (safeFilters.cardId) { where.push(`t.instrument_id = $${paramIndex++}`); params.push(safeFilters.cardId); }
        if (safeFilters.instrumentType) { where.push(`t.instrument_type = $${paramIndex++}`); params.push(safeFilters.instrumentType); }
        if (safeFilters.instrumentId) { where.push(`t.instrument_id = $${paramIndex++}`); params.push(safeFilters.instrumentId); }
        if (safeFilters.direction) { where.push(`t.direction = $${paramIndex++}`); params.push(safeFilters.direction); }
        if (safeFilters.from) { where.push(`t.transaction_date >= $${paramIndex++}`); params.push(safeFilters.from); }
        if (safeFilters.to) { where.push(`t.transaction_date <= $${paramIndex++}`); params.push(safeFilters.to); }
        if (safeFilters.billMonth) { where.push(`t.bill_month = $${paramIndex++}`); params.push(safeFilters.billMonth); }
        if (safeFilters.billYear) { where.push(`t.bill_year = $${paramIndex++}`); params.push(safeFilters.billYear); }
        if (safeFilters.category) { where.push(`t.category = $${paramIndex++}`); params.push(safeFilters.category); }
        if (safeFilters.transactionType) { where.push(`t.transaction_type = $${paramIndex++}`); params.push(safeFilters.transactionType); }
        if (safeFilters.merchant) { where.push(`t.merchant ILIKE $${paramIndex++}`); params.push(`%${safeFilters.merchant}%`); }
        if (safeFilters.needsReview !== undefined) { where.push(`t.needs_review = $${paramIndex++}`); params.push(safeFilters.needsReview); }
        if (safeFilters.search) {
            where.push(`(
              t.search_vector @@ plainto_tsquery('english', $${paramIndex}) 
              OR t.merchant ILIKE $${paramIndex + 1} 
              OR t.description ILIKE $${paramIndex + 1}
            )`);
            params.push(safeFilters.search);
            params.push(`%${safeFilters.search}%`);
            paramIndex += 2;
        }

        const whereClause = where.join(' AND ');
        const limit = safeFilters.limit || 50;
        const offset = safeFilters.offset || 0;
        const sortBy = safeFilters.sortBy || 'transaction_date';
        const sortOrder = safeFilters.sortOrder || 'desc';
        // Validate sort column to prevent SQL injection
        const validSortColumns = ['transaction_date', 'amount', 'merchant', 'category'];
        const sortColumn = validSortColumns.includes(sortBy) ? `t.${sortBy}` : 't.transaction_date';
        const orderDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        const dataResult = await query(
            `SELECT t.*, 
              count(*) OVER() as total_count,
              json_build_object(
                'id', i.id,
                'card_name', i.name,
                'bank_name', b.name,
                'last_four', i.last4
              ) as card
             FROM transactions t
             LEFT JOIN instruments i ON t.instrument_id = i.id
             LEFT JOIN banks b ON i.bank_id = b.id
             WHERE ${whereClause}
             ORDER BY ${sortColumn} ${orderDirection}
             LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
            [...params, limit, offset]
        );

        const total = dataResult.rows.length > 0 ? parseInt(dataResult.rows[0].total_count) : 0;
        const data = dataResult.rows.map(row => {
            const { total_count, ...transaction } = row;
            return transaction;
        });

        return { data: data as Transaction[], total };
    }

    /**
     * Get spending aggregations
     */
    static async getAggregations(
        userId: string,
        filters: TransactionFilters
    ): Promise<{
        totalSpent: number;
        totalTransactions: number;
        byCategory: Array<{ category: string; total: number; count: number }>;
    }> {
        const where: string[] = ['user_id = $1', "direction = 'debit'"];
        const params: any[] = [userId];
        let paramIndex = 2;
        const safeFilters = filters || {};

        if (safeFilters.from) { where.push(`transaction_date >= $${paramIndex++}`); params.push(safeFilters.from); }
        if (safeFilters.to) { where.push(`transaction_date <= $${paramIndex++}`); params.push(safeFilters.to); }
        if (safeFilters.billMonth && safeFilters.billYear) {
            where.push(`bill_month = $${paramIndex++} AND bill_year = $${paramIndex++}`);
            params.push(safeFilters.billMonth, safeFilters.billYear);
        }

        const whereClause = where.join(' AND ');

        const result = await query(
            `SELECT 
              category, 
              SUM(amount) as cat_total, 
              COUNT(*) as cat_count,
              SUM(SUM(amount)) OVER() as grand_total,
              SUM(COUNT(*)) OVER() as grand_count
             FROM transactions 
             WHERE ${whereClause}
             GROUP BY category
             ORDER BY cat_total DESC`,
            params
        );

        const rows = result.rows;
        const totalSpent = rows.length > 0 ? parseFloat(rows[0].grand_total) : 0;
        const totalTransactions = rows.length > 0 ? parseInt(rows[0].grand_count) : 0;

        return {
            totalSpent,
            totalTransactions,
            byCategory: rows.map(row => ({
                category: row.category,
                total: parseFloat(row.cat_total),
                count: parseInt(row.cat_count),
            })),
        };
    }
}
