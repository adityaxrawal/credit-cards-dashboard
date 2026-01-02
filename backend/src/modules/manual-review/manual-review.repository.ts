/**
 * Manual Review Repository
 * Data access layer for manual review queue operations
 */

import { query } from '@shared/database/db';

export class ManualReviewRepository {
    /**
     * Get queue count
     */
    static async getQueueCount(userId: string): Promise<number> {
        const result = await query(
            `SELECT COUNT(*) FROM manual_review_queue WHERE user_id = $1 AND status = 'pending'`,
            [userId]
        );
        return parseInt(result.rows[0]?.count || '0');
    }

    /**
     * Get queue items
     */
    static async getQueue(userId: string, limit: number, offset: number): Promise<any[]> {
        const result = await query(
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
        return result.rows;
    }

    /**
     * Get review item by ID
     */
    static async getById(itemId: string, userId: string): Promise<any> {
        const result = await query(
            `SELECT * FROM manual_review_queue WHERE id = $1 AND user_id = $2`,
            [itemId, userId]
        );
        return result.rows[0] || null;
    }

    /**
     * Approve item
     */
    static async approveItem(itemId: string, userId: string, classification: any, transactionId: string): Promise<void> {
        await query(
            `UPDATE manual_review_queue 
             SET status = 'approved', 
             reviewed_at = NOW(),
             final_classification = $3,
             created_transaction_id = $4,
             updated_at = NOW()
             WHERE id = $1 AND user_id = $2`,
            [itemId, userId, JSON.stringify(classification), transactionId]
        );
    }

    /**
     * Reject item
     */
    static async rejectItem(itemId: string, userId: string, reason: string): Promise<boolean> {
        const result = await query(
            `UPDATE manual_review_queue 
             SET status = 'rejected', 
             reviewed_at = NOW(),
             review_notes = $3,
             updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [itemId, userId, reason]
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Skip item
     */
    static async skipItem(itemId: string, userId: string): Promise<boolean> {
        const result = await query(
            `UPDATE manual_review_queue 
             SET status = 'skipped',
             updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [itemId, userId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Get queue statistics
     */
    static async getStats(userId: string): Promise<any> {
        const result = await query(
            `SELECT 
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'approved') as approved,
                COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
                COUNT(*) as total
             FROM manual_review_queue 
             WHERE user_id = $1`,
            [userId]
        );
        return result.rows[0] || { pending: 0, approved: 0, rejected: 0, total: 0 };
    }

    /**
     * Update item status (approve/reject/skip)
     */
    static async updateStatus(
        userId: string,
        itemId: string,
        updates: {
            status: string;
            reviewNotes?: string;
            finalClassification?: any;
            reviewedByUserId?: string;
            createdTransactionId?: string;
        }
    ): Promise<boolean> {
        const sets: string[] = [`status = $3`, `reviewed_at = NOW()`, `updated_at = NOW()`];
        const params: any[] = [itemId, userId, updates.status];
        let idx = 4;

        if (updates.reviewNotes !== undefined) {
            sets.push(`review_notes = $${idx++}`);
            params.push(updates.reviewNotes);
        }
        if (updates.finalClassification !== undefined) {
            sets.push(`final_classification = $${idx++}`);
            params.push(JSON.stringify(updates.finalClassification));
        }
        if (updates.reviewedByUserId !== undefined) {
            sets.push(`reviewed_by_user_id = $${idx++}`);
            params.push(updates.reviewedByUserId);
        }
        if (updates.createdTransactionId !== undefined) {
            sets.push(`created_transaction_id = $${idx++}`);
            params.push(updates.createdTransactionId);
        }

        const result = await query(
            `UPDATE manual_review_queue SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING id`,
            params
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Add item to queue (for error recovery)
     */
    static async addToQueue(item: {
        userId: string;
        emailId: string;
        subject?: string;
        snippet?: string;
        sender?: string;
        suggestedType?: string;
        suggestedMerchant?: string;
        suggestedAmount?: number;
        suggestedClassification?: any;
        reviewReason: string;
        retryCount: number;
        scanJobId?: string;
    }): Promise<void> {
        await query(
            `INSERT INTO manual_review_queue (
          email_id, user_id, email_subject, email_snippet, email_sender,
          suggested_type, suggested_merchant, suggested_amount, 
          suggested_classification, review_reason, retry_count,
          scan_job_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        ON CONFLICT (email_id, user_id) DO UPDATE SET
          retry_count = manual_review_queue.retry_count + 1,
          review_reason = EXCLUDED.review_reason,
          updated_at = NOW()`,
            [
                item.emailId,
                item.userId,
                item.subject,
                item.snippet,
                item.sender,
                item.suggestedType,
                item.suggestedMerchant,
                item.suggestedAmount,
                item.suggestedClassification ? JSON.stringify(item.suggestedClassification) : null,
                item.reviewReason,
                item.retryCount,
                item.scanJobId
            ]
        );
    }
}
