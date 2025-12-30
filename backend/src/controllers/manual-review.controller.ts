/**
 * Manual Review Controller
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
import { ManualReviewService } from '../services/manual-review/ManualReviewService';
import logger from '../utils/infrastructure/logger';
import { z } from 'zod';

const ApproveSchema = z.object({
    transactionType: z.string().optional(),
    category: z.string().optional(),
    merchant: z.string().optional(),
    amount: z.number().positive().optional(),
    direction: z.enum(['credit', 'debit']).optional(),
});

const RejectSchema = z.object({
    reason: z.string().min(1, 'Reason is required'),
});

const BulkApproveSchema = z.object({
    itemIds: z.array(z.string().uuid()).min(1),
    defaultData: ApproveSchema,
});

/**
 * Get review queue
 */
export async function getQueue(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const result = await ManualReviewService.getQueue(userId, limit, offset);

        res.json({
            success: true,
            data: result.items,
            pagination: {
                limit,
                offset,
                total: result.total,
            },
        });
    } catch (error) {
        logger.error('get_review_queue_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const stats = await ManualReviewService.getQueueStats(userId);

        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        logger.error('get_queue_stats_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Approve an item
 */
export async function approveItem(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const validatedData = await ApproveSchema.parseAsync(req.body);

        const result = await ManualReviewService.approveItem(userId, id, validatedData);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error,
            });
        }

        res.json({
            success: true,
            data: {
                transactionId: result.transactionId,
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(422).json({
                success: false,
                error: 'Validation error',
                details: error.errors,
            });
        }
        logger.error('approve_item_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Reject an item
 */
export async function rejectItem(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const validatedData = await RejectSchema.parseAsync(req.body);

        const result = await ManualReviewService.rejectItem(userId, id, validatedData.reason);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error,
            });
        }

        res.json({
            success: true,
            message: 'Item rejected successfully',
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(422).json({
                success: false,
                error: 'Validation error',
                details: error.errors,
            });
        }
        logger.error('reject_item_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Skip an item
 */
export async function skipItem(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const result = await ManualReviewService.skipItem(userId, id);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error,
            });
        }

        res.json({
            success: true,
            message: 'Item skipped',
        });
    } catch (error) {
        logger.error('skip_item_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Bulk approve items
 */
export async function bulkApprove(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;

        const validatedData = await BulkApproveSchema.parseAsync(req.body);

        const result = await ManualReviewService.bulkApprove(
            userId,
            validatedData.itemIds,
            validatedData.defaultData
        );

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(422).json({
                success: false,
                error: 'Validation error',
                details: error.errors,
            });
        }
        logger.error('bulk_approve_error', { error, userId: req.user?.id });
        next(error);
    }
}
