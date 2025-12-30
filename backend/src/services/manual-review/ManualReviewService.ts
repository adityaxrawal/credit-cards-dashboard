import { UnclassifiedRepository } from './UnclassifiedRepository';
import { UnclassifiedRecord } from '../../types/transaction.types';
import pool from '../../lib/db';
import logger from '../../utils/infrastructure/logger';
import * as transactionsService from '../transactions/TransactionService';

export interface ReviewQueueItem {
    id: string;
    emailId: string;
    userId: string;
    emailSubject: string;
    emailSnippet: string;
    emailSender: string;
    suggestedType: string | null;
    suggestedMerchant: string | null;
    suggestedAmount: number | null;
    suggestedClassification: any;
    reviewReason: string;
    retryCount: number;
    status: 'pending' | 'approved' | 'rejected' | 'skipped';
    createdAt: Date;
}

export interface ApproveData {
    transactionType?: string;
    category?: string;
    merchant?: string;
    amount?: number;
    direction?: 'credit' | 'debit';
}

export interface ReviewStats {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
}

export class ManualReviewService {

    /**
     * Get pending items from JSON file (legacy)
     */
    static async getLegacyQueue(): Promise<UnclassifiedRecord[]> {
        return UnclassifiedRepository.getAll();
    }

    /**
     * Get pending items from database queue
     */
    static async getQueue(userId: string, limit = 50, offset = 0): Promise<{
        items: ReviewQueueItem[];
        total: number;
    }> {
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM manual_review_queue WHERE user_id = $1 AND status = 'pending'`,
            [userId]
        );
        const total = parseInt(countResult.rows[0]?.count || '0');

        const result = await pool.query(
            `SELECT 
                id, email_id as "emailId", user_id as "userId",
                email_subject as "emailSubject", email_snippet as "emailSnippet",
                email_sender as "emailSender", suggested_type as "suggestedType",
                suggested_merchant as "suggestedMerchant", 
                suggested_amount as "suggestedAmount",
                suggested_classification as "suggestedClassification",
                review_reason as "reviewReason", retry_count as "retryCount",
                status, created_at as "createdAt"
             FROM manual_review_queue 
             WHERE user_id = $1 AND status = 'pending'
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        return {
            items: result.rows,
            total,
        };
    }

    /**
     * Approve an item and create a transaction
     */
    static async approveItem(
        userId: string,
        itemId: string,
        data: ApproveData
    ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
        // Get the review item
        const itemResult = await pool.query(
            `SELECT * FROM manual_review_queue WHERE id = $1 AND user_id = $2`,
            [itemId, userId]
        );

        if (itemResult.rows.length === 0) {
            return { success: false, error: 'Review item not found' };
        }

        const item = itemResult.rows[0];

        try {
            // Create a transaction from the approved data
            const transaction = await transactionsService.createManualTransaction({
                userId,
                instrumentType: 'credit_card', // Default
                instrumentId: '', // Will be empty for now
                transactionDate: new Date(item.created_at),
                merchant: data.merchant || item.suggested_merchant || 'Unknown',
                category: data.category || 'other',
                amount: data.amount || item.suggested_amount || 0,
                transactionType: data.transactionType || item.suggested_type || 'debit',
                direction: data.direction || 'debit',
            });

            if (!transaction) {
                return { success: false, error: 'Failed to create transaction' };
            }

            // Update the review queue item
            await pool.query(
                `UPDATE manual_review_queue 
                 SET status = 'approved', 
                     reviewed_at = NOW(),
                     final_classification = $3,
                     created_transaction_id = $4,
                     updated_at = NOW()
                 WHERE id = $1 AND user_id = $2`,
                [itemId, userId, JSON.stringify(data), transaction.id]
            );

            logger.info('review_item_approved', { itemId, userId, transactionId: transaction.id });

            return { success: true, transactionId: transaction.id };
        } catch (error) {
            logger.error('review_item_approve_error', { error, itemId, userId });
            return { success: false, error: 'Failed to create transaction' };
        }
    }

    /**
     * Reject an item
     */
    static async rejectItem(
        userId: string,
        itemId: string,
        reason: string
    ): Promise<{ success: boolean; error?: string }> {
        const result = await pool.query(
            `UPDATE manual_review_queue 
             SET status = 'rejected', 
                 reviewed_at = NOW(),
                 review_notes = $3,
                 updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [itemId, userId, reason]
        );

        if (result.rowCount === 0) {
            return { success: false, error: 'Review item not found' };
        }

        logger.info('review_item_rejected', { itemId, userId, reason });
        return { success: true };
    }

    /**
     * Skip an item (defer for later)
     */
    static async skipItem(
        userId: string,
        itemId: string
    ): Promise<{ success: boolean; error?: string }> {
        const result = await pool.query(
            `UPDATE manual_review_queue 
             SET status = 'skipped',
                 updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [itemId, userId]
        );

        if (result.rowCount === 0) {
            return { success: false, error: 'Review item not found' };
        }

        return { success: true };
    }

    /**
     * Bulk approve items
     */
    static async bulkApprove(
        userId: string,
        itemIds: string[],
        defaultData: ApproveData
    ): Promise<{ approved: number; failed: number }> {
        let approved = 0;
        let failed = 0;

        for (const itemId of itemIds) {
            const result = await this.approveItem(userId, itemId, defaultData);
            if (result.success) {
                approved++;
            } else {
                failed++;
            }
        }

        return { approved, failed };
    }

    /**
     * Get queue statistics
     */
    static async getQueueStats(userId: string): Promise<ReviewStats> {
        const result = await pool.query(
            `SELECT 
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'approved') as approved,
                COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
                COUNT(*) as total
             FROM manual_review_queue 
             WHERE user_id = $1`,
            [userId]
        );

        const row = result.rows[0] || {};
        return {
            pending: parseInt(row.pending || '0'),
            approved: parseInt(row.approved || '0'),
            rejected: parseInt(row.rejected || '0'),
            total: parseInt(row.total || '0'),
        };
    }

    /**
     * Mark a legacy item as handled (JSON file)
     */
    static async markAsHandled(id: string): Promise<void> {
        await UnclassifiedRepository.remove(id);
    }

    /**
     * Suggest a rule based on an example (placeholder)
     */
    static suggestRule(recordId: string, type: 'noise' | 'transaction'): string {
        return `Suggesting rule for ${recordId} as ${type}`;
    }
}
