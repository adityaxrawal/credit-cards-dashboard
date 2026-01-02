import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
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

export interface IManualReviewService {
    getQueue(userId: string, limit: number, offset: number): Promise<any>;
    getQueueStats(userId: string): Promise<any>;
    approveItem(userId: string, itemId: string, data: any): Promise<any>;
    rejectItem(userId: string, itemId: string, reason: string): Promise<any>;
    skipItem(userId: string, itemId: string): Promise<any>;
    bulkApprove(userId: string, itemIds: string[], defaultData: any): Promise<any>;
}

export interface IManualReviewController {
    getQueue(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getQueueStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    approveItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    rejectItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    skipItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    bulkApprove(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

export function createManualReviewController(service: IManualReviewService): IManualReviewController {
    return {
        async getQueue(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const limit = parseInt(req.query.limit as string) || 50;
                const offset = parseInt(req.query.offset as string) || 0;

                const result = await service.getQueue(userId, limit, offset);

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
        },

        async getQueueStats(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const stats = await service.getQueueStats(userId);

                res.json({
                    success: true,
                    data: stats,
                });
            } catch (error) {
                logger.error('get_queue_stats_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async approveItem(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { id } = req.params;

                const validatedData = await ApproveSchema.parseAsync(req.body);

                const result = await service.approveItem(userId, id, validatedData);

                if (!result.success) {
                    res.status(400).json({
                        success: false,
                        error: result.error,
                    });
                    return;
                }

                res.json({
                    success: true,
                    data: {
                        transactionId: result.transactionId,
                    },
                });
            } catch (error) {
                if (error instanceof z.ZodError) {
                    res.status(422).json({
                        success: false,
                        error: 'Validation error',
                        details: error.errors,
                    });
                    return;
                }
                logger.error('approve_item_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async rejectItem(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { id } = req.params;

                const validatedData = await RejectSchema.parseAsync(req.body);

                const result = await service.rejectItem(userId, id, validatedData.reason);

                if (!result.success) {
                    res.status(400).json({
                        success: false,
                        error: result.error,
                    });
                    return;
                }

                res.json({
                    success: true,
                    message: 'Item rejected successfully',
                });
            } catch (error) {
                if (error instanceof z.ZodError) {
                    res.status(422).json({
                        success: false,
                        error: 'Validation error',
                        details: error.errors,
                    });
                    return;
                }
                logger.error('reject_item_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async skipItem(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { id } = req.params;

                const result = await service.skipItem(userId, id);

                if (!result.success) {
                    res.status(400).json({
                        success: false,
                        error: result.error,
                    });
                    return;
                }

                res.json({
                    success: true,
                    message: 'Item skipped',
                });
            } catch (error) {
                logger.error('skip_item_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async bulkApprove(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;

                const validatedData = await BulkApproveSchema.parseAsync(req.body);

                const result = await service.bulkApprove(
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
                    res.status(422).json({
                        success: false,
                        error: 'Validation error',
                        details: error.errors,
                    });
                    return;
                }
                logger.error('bulk_approve_error', { error, userId: req.user?.id });
                next(error);
            }
        }
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { ManualReviewService } from '../services/manual-review/ManualReviewService';

// Adapter for static method service
const manualReviewServiceAdapter: IManualReviewService = {
    getQueue: (userId, limit, offset) => ManualReviewService.getQueue(userId, limit, offset),
    getQueueStats: (userId) => ManualReviewService.getQueueStats(userId),
    approveItem: (userId, id, data) => ManualReviewService.approveItem(userId, id, data),
    rejectItem: (userId, id, reason) => ManualReviewService.rejectItem(userId, id, reason),
    skipItem: (userId, id) => ManualReviewService.skipItem(userId, id),
    bulkApprove: (userId, ids, data) => ManualReviewService.bulkApprove(userId, ids, data)
};

const defaultController = createManualReviewController(manualReviewServiceAdapter);

export const getQueue = defaultController.getQueue;
export const getQueueStats = defaultController.getQueueStats;
export const approveItem = defaultController.approveItem;
export const rejectItem = defaultController.rejectItem;
export const skipItem = defaultController.skipItem;
export const bulkApprove = defaultController.bulkApprove;

