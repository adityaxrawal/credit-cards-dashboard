import { Request, Response, NextFunction } from 'express';
import { billsService } from '../services/bills/BillsService';
import logger from '../utils/infrastructure/logger';


/**
 * Get all bills for the authenticated user
 */
export async function getAllBills(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit as string) || 50;
        const cursor = req.query.cursor as string;

        const result = await billsService.getAllBills(userId, limit, cursor);

        res.json({
            success: true,
            data: result.data,
            pagination: {
                limit,
                nextCursor: result.nextCursor
            }
        });
    } catch (error) {
        logger.error('get_all_bills_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Get a specific bill by ID
 */
export async function getBillById(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user.id;
        const { billId } = req.params;

        const bill = await billsService.getBillById(userId, billId);

        if (!bill) {
            return res.status(404).json({
                success: false,
                error: 'Bill not found'
            });
        }

        res.json({
            success: true,
            data: bill
        });
    } catch (error) {
        logger.error('get_bill_by_id_error', { error, userId: req.user?.id, billId: req.params.billId });
        next(error);
    }
}

/**
 * Get bills for a specific card
 */
export async function getCardBills(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user.id;
        const { cardId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;
        const cursor = req.query.cursor as string;

        const result = await billsService.getCardBills(userId, cardId, limit, cursor);

        res.json({
            success: true,
            data: result.data,
            pagination: {
                limit,
                nextCursor: result.nextCursor
            }
        });
    } catch (error) {
        logger.error('get_card_bills_error', { error, userId: req.user?.id, cardId: req.params.cardId });
        next(error);
    }
}

/**
 * Get upcoming bills (unpaid/pending)
 */
export async function getUpcomingBills(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = parseInt(req.query.offset as string) || 0;

        const bills = await billsService.getUpcomingBills(userId, limit, offset);

        res.json({
            success: true,
            data: bills,
            pagination: {
                limit,
                offset,
                total: bills.length
            }
        });
    } catch (error) {
        logger.error('get_upcoming_bills_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Create a new bill
 */
import { z } from 'zod';
import { CreateBillSchema, UpdateBillSchema } from '../validators/other.schema';

/**
 * Create a new bill
 */
export async function createBill(req: Request, res: Response, next: NextFunction) {
    try {
        // Zod Validation
        // CreateBillSchema expects cardId, billDate, dueDate, amount
        // Controller expects billMonth, billYear, which might be extra or derived.
        // Let's extend schema or use explicit parsing if schema differs slightly.
        // The schema had amount, controller had billAmount.
        // I will use a local adaptation or modify schema usage.

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

        res.status(201).json({
            success: true,
            data: bill
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(422).json({
                success: false,
                error: 'Validation Error',
                details: error.errors
            });
        }
        logger.error('create_bill_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Update a bill
 */
export async function updateBill(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user.id;
        const { billId } = req.params;
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

        const val = await LocalUpdateBillSchema.parseAsync(req.body);

        const updatePayload: any = { ...val };
        if (val.billDate) updatePayload.billDate = new Date(val.billDate);
        if (val.dueDate) updatePayload.dueDate = new Date(val.dueDate);

        const updatedBill = await billsService.updateBill(userId, billId, updatePayload);

        if (!updatedBill) {
            return res.status(404).json({
                success: false,
                error: 'Bill not found or update failed'
            });
        }

        logger.info('bill_updated', { billId, userId });

        res.json({
            success: true,
            data: updatedBill
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(422).json({
                success: false,
                error: 'Validation Error',
                details: error.errors
            });
        }
        logger.error('update_bill_error', { error, userId: req.user?.id, billId: req.params.billId });
        next(error);
    }
}

/**
 * Delete a bill
 */
export async function deleteBill(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user.id;
        const { billId } = req.params;

        const deleted = await billsService.deleteBill(userId, billId);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Bill not found'
            });
        }

        logger.info('bill_deleted', { billId, userId });

        res.json({
            success: true,
            message: 'Bill deleted successfully'
        });
    } catch (error) {
        logger.error('delete_bill_error', { error, userId: req.user?.id, billId: req.params.billId });
        next(error);
    }
}
