/**
 * Bills Controller
 * 
 * Handles bill management endpoints.
 * Uses factory pattern for dependency injection.
 * 
 * Part of Issue #12: Controller-Service Dependency Injection
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '@shared/utils/infrastructure/logger';

/**
 * Bills Service Interface
 */
export interface IBillsService {
    getAllBills(userId: string, limit: number, cursor?: string): Promise<{ data: any[]; nextCursor?: string }>;
    getBillById(userId: string, billId: string): Promise<any>;
    getCardBills(userId: string, cardId: string, limit: number, cursor?: string): Promise<{ data: any[]; nextCursor?: string }>;
    getUpcomingBills(userId: string, limit: number, offset: number): Promise<any[]>;
    createBill(data: any): Promise<any>;
    updateBill(userId: string, billId: string, updates: any): Promise<any>;
    deleteBill(userId: string, billId: string): Promise<boolean>;
}

/**
 * Controller Interface
 */
export interface IBillsController {
    getAllBills(req: Request, res: Response, next: NextFunction): Promise<void>;
    getBillById(req: Request, res: Response, next: NextFunction): Promise<void>;
    getCardBills(req: Request, res: Response, next: NextFunction): Promise<void>;
    getUpcomingBills(req: Request, res: Response, next: NextFunction): Promise<void>;
    createBill(req: Request, res: Response, next: NextFunction): Promise<void>;
    updateBill(req: Request, res: Response, next: NextFunction): Promise<void>;
    deleteBill(req: Request, res: Response, next: NextFunction): Promise<void>;
}

/**
 * Factory function to create Bills controller with injected dependencies
 */
export function createBillsController(billsService: IBillsService): IBillsController {
    const LocalCreateBillSchema = z.object({
        cardId: z.string().uuid(),
        billMonth: z.number().min(1).max(12),
        billYear: z.number().min(2000),
        billAmount: z.number().positive(),
        billDate: z.string().datetime().or(z.date()),
        dueDate: z.string().datetime().or(z.date()),
        paymentStatus: z.enum(['paid', 'unpaid', 'partial']).optional(),
        notes: z.string().optional()
    });

    const LocalUpdateBillSchema = z.object({
        cardId: z.string().uuid().optional(),
        billMonth: z.number().min(1).max(12).optional(),
        billYear: z.number().min(2000).optional(),
        billAmount: z.number().positive().optional(),
        billDate: z.string().datetime().or(z.date()).optional(),
        dueDate: z.string().datetime().or(z.date()).optional(),
        paymentStatus: z.enum(['paid', 'unpaid', 'partial']).optional(),
        notes: z.string().optional()
    });

    return {
        async getAllBills(req: Request, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const limit = parseInt(req.query.limit as string) || 50;
                const cursor = req.query.cursor as string;
                const result = await billsService.getAllBills(userId, limit, cursor);
                res.json({ success: true, data: result.data, pagination: { limit, nextCursor: result.nextCursor } });
            } catch (error) {
                logger.error('get_all_bills_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async getBillById(req: Request, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { billId } = req.params;
                const bill = await billsService.getBillById(userId, billId);
                if (!bill) {
                    return res.status(404).json({ success: false, error: 'Bill not found' }) as any;
                }
                res.json({ success: true, data: bill });
            } catch (error) {
                logger.error('get_bill_by_id_error', { error, userId: req.user?.id, billId: req.params.billId });
                next(error);
            }
        },

        async getCardBills(req: Request, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { cardId } = req.params;
                const limit = parseInt(req.query.limit as string) || 50;
                const cursor = req.query.cursor as string;
                const result = await billsService.getCardBills(userId, cardId, limit, cursor);
                res.json({ success: true, data: result.data, pagination: { limit, nextCursor: result.nextCursor } });
            } catch (error) {
                logger.error('get_card_bills_error', { error, userId: req.user?.id, cardId: req.params.cardId });
                next(error);
            }
        },

        async getUpcomingBills(req: Request, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const limit = parseInt(req.query.limit as string) || 20;
                const offset = parseInt(req.query.offset as string) || 0;
                const bills = await billsService.getUpcomingBills(userId, limit, offset);
                res.json({ success: true, data: bills, pagination: { limit, offset, total: bills.length } });
            } catch (error) {
                logger.error('get_upcoming_bills_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async createBill(req: Request, res: Response, next: NextFunction) {
            try {
                const val = await LocalCreateBillSchema.parseAsync(req.body);
                if (!req.user) {
                    res.status(401).json({ message: 'Unauthorized' });
                    return;
                }
                const bill = await billsService.createBill({
                    userId: req.user.id,
                    cardId: val.cardId,
                    billMonth: val.billMonth,
                    billYear: val.billYear,
                    billAmount: val.billAmount,
                    billDate: new Date(val.billDate),
                    dueDate: new Date(val.dueDate),
                    paymentStatus: val.paymentStatus,
                    notes: val.notes
                });
                logger.info('bill_created', { billId: bill.id, userId: req.user?.id });
                res.status(201).json({ success: true, data: bill });
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return res.status(422).json({ success: false, error: 'Validation Error', details: error.errors }) as any;
                }
                logger.error('create_bill_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async updateBill(req: Request, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { billId } = req.params;
                const val = await LocalUpdateBillSchema.parseAsync(req.body);
                const updatePayload: any = { ...val };
                if (val.billDate) updatePayload.billDate = new Date(val.billDate);
                if (val.dueDate) updatePayload.dueDate = new Date(val.dueDate);
                const updatedBill = await billsService.updateBill(userId, billId, updatePayload);
                if (!updatedBill) {
                    return res.status(404).json({ success: false, error: 'Bill not found or update failed' }) as any;
                }
                logger.info('bill_updated', { billId, userId });
                res.json({ success: true, data: updatedBill });
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return res.status(422).json({ success: false, error: 'Validation Error', details: error.errors }) as any;
                }
                logger.error('update_bill_error', { error, userId: req.user?.id, billId: req.params.billId });
                next(error);
            }
        },

        async deleteBill(req: Request, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { billId } = req.params;
                const deleted = await billsService.deleteBill(userId, billId);
                if (!deleted) {
                    return res.status(404).json({ success: false, error: 'Bill not found' }) as any;
                }
                logger.info('bill_deleted', { billId, userId });
                res.json({ success: true, message: 'Bill deleted successfully' });
            } catch (error) {
                logger.error('delete_bill_error', { error, userId: req.user?.id, billId: req.params.billId });
                next(error);
            }
        },
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { billsService } from './bills.service';

const defaultController = createBillsController(billsService as IBillsService);

export const getAllBills = defaultController.getAllBills;
export const getBillById = defaultController.getBillById;
export const getCardBills = defaultController.getCardBills;
export const getUpcomingBills = defaultController.getUpcomingBills;
export const createBill = defaultController.createBill;
export const updateBill = defaultController.updateBill;
export const deleteBill = defaultController.deleteBill;
