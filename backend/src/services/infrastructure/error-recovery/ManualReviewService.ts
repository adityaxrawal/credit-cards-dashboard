import { ManualReviewRepository } from '../../../repositories/ManualReviewRepository';
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
            await ManualReviewRepository.addToQueue({
                userId: context.userId,
                emailId: context.emailId,
                subject: context.subject,
                snippet: context.snippet?.substring(0, 1000),
                sender: context.sender,
                suggestedType: suggestedClassification?.type,
                suggestedMerchant: suggestedClassification?.merchant,
                suggestedAmount: suggestedClassification?.amount,
                suggestedClassification: suggestedClassification?.classification,
                reviewReason: reason,
                retryCount: context.retryCount,
                scanJobId: context.jobId
            });
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
        const total = await ManualReviewRepository.getQueueCount(userId);
        const items = await ManualReviewRepository.getQueue(userId, limit, offset);

        return { items, total };
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
        // Note: Transaction creation is handled by the main ManualReviewService or client
        // This method strictly updates the status
        await ManualReviewRepository.updateStatus(userId, reviewId, {
            status: 'approved',
            finalClassification,
            reviewNotes: notes,
            reviewedByUserId: userId
        });
    }

    /**
     * Reject a manual review item
     */
    static async rejectReview(
        reviewId: string,
        userId: string,
        notes?: string
    ): Promise<void> {
        await ManualReviewRepository.updateStatus(userId, reviewId, {
            status: 'rejected',
            reviewNotes: notes,
            reviewedByUserId: userId
        });
    }
}
