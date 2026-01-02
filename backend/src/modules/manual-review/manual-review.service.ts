import { UnclassifiedRepository } from './unclassified.repository';
import { UnclassifiedRecord } from '@shared/types/transaction.types';
import { ManualReviewRepository } from '@modules/manual-review/manual-review.repository';
import logger from '@shared/utils/infrastructure/logger';
import * as transactionsService from '@modules/transactions/services/TransactionService';

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
        const total = await ManualReviewRepository.getQueueCount(userId);
        const items = await ManualReviewRepository.getQueue(userId, limit, offset);

        return {
            items: items as ReviewQueueItem[],
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
        const item = await ManualReviewRepository.getById(itemId, userId);

        if (!item) {
            return { success: false, error: 'Review item not found' };
        }

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
            await ManualReviewRepository.updateStatus(userId, itemId, {
                status: 'approved',
                finalClassification: data,
                reviewedByUserId: userId,
                createdTransactionId: transaction.id
            });

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
        const success = await ManualReviewRepository.rejectItem(itemId, userId, reason);

        if (!success) {
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
        const success = await ManualReviewRepository.skipItem(itemId, userId);

        if (!success) {
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
        const stats = await ManualReviewRepository.getStats(userId);
        return {
            pending: parseInt(stats.pending || '0'),
            approved: parseInt(stats.approved || '0'),
            rejected: parseInt(stats.rejected || '0'),
            total: parseInt(stats.total || '0'),
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
