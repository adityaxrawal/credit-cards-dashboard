import pool from '../../../lib/db';
import logger from '../../../utils/infrastructure/logger';

interface EmailContext {
    userId: string;
    emailId: string;
    subject?: string;
    snippet?: string;
    sender?: string;
    retryCount: number;
    jobId?: string;
}

export class ManualReviewService {
    /**
     * Add an email to the manual review queue
     */
    static async markForManualReview(
        context: EmailContext,
        reason: string,
        suggestedClassification?: {
            type?: string;
            merchant?: string;
            amount?: number;
            classification?: any;
        }
    ): Promise<void> {
        try {
            await pool.query(
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
                    context.emailId,
                    context.userId,
                    context.subject,
                    context.snippet?.substring(0, 1000),
                    context.sender,
                    suggestedClassification?.type,
                    suggestedClassification?.merchant,
                    suggestedClassification?.amount,
                    suggestedClassification?.classification ? JSON.stringify(suggestedClassification.classification) : null,
                    reason,
                    context.retryCount,
                    context.jobId
                ]
            );
            logger.info(`[ManualReviewService] Marked ${context.emailId} for manual review: ${reason}`);
        } catch (err) {
            logger.error('[ManualReviewService] Failed to mark for manual review', err);
        }
    }

    /**
     * Get pending items from the manual review queue
     */
    static async getPendingReviews(
        userId: string,
        limit: number = 50,
        offset: number = 0
    ): Promise<{ items: any[]; total: number }> {
        const countResult = await pool.query(
            `SELECT COUNT(*) as total FROM manual_review_queue 
       WHERE user_id = $1 AND status = 'pending'`,
            [userId]
        );

        const itemsResult = await pool.query(
            `SELECT * FROM manual_review_queue 
       WHERE user_id = $1 AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        return {
            items: itemsResult.rows,
            total: parseInt(countResult.rows[0].total, 10)
        };
    }

    /**
     * Approve a manual review item
     */
    static async approveReview(
        reviewId: string,
        userId: string,
        finalClassification: any,
        notes?: string
    ): Promise<void> {
        await pool.query(
            `UPDATE manual_review_queue SET
        status = 'approved',
        final_classification = $1,
        review_notes = $2,
        reviewed_by_user_id = $3,
        reviewed_at = NOW(),
        updated_at = NOW()
       WHERE id = $4 AND user_id = $3`,
            [JSON.stringify(finalClassification), notes, userId, reviewId]
        );
    }

    /**
     * Reject a manual review item
     */
    static async rejectReview(
        reviewId: string,
        userId: string,
        notes?: string
    ): Promise<void> {
        await pool.query(
            `UPDATE manual_review_queue SET
        status = 'rejected',
        review_notes = $1,
        reviewed_by_user_id = $2,
        reviewed_at = NOW(),
        updated_at = NOW()
       WHERE id = $3 AND user_id = $2`,
            [notes, userId, reviewId]
        );
    }
}
