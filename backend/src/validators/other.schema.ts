import { z } from 'zod';

// --- Card Schemas ---
export const CreateCardSchema = z.object({
    cardName: z.string().min(1, 'Card name is required').max(255),
    bankName: z.string().min(1, 'Bank name is required').max(255),
    lastFour: z.string().length(4, 'Last four digits must be exactly 4 characters').regex(/^\d+$/, 'Last four must be digits'),
    billDate: z.number().min(1).max(31),
    dueDate: z.number().min(1).max(31),
    creditLimit: z.number().positive(),
    activationDate: z.string().datetime().or(z.date()).optional(),
    notes: z.string().max(1000).optional()
});

export const UpdateCardSchema = z.object({
    cardName: z.string().min(1).max(255).optional(),
    bankName: z.string().min(1).max(255).optional(),
    lastFour: z.string().length(4).regex(/^\d+$/).optional(),
    billDate: z.number().min(1).max(31).optional(),
    dueDate: z.number().min(1).max(31).optional(),
    creditLimit: z.number().positive().optional(),
    activationDate: z.string().datetime().or(z.date()).optional(),
    notes: z.string().max(1000).optional(),
    isActive: z.boolean().optional()
});

// --- Budget Schemas ---
export const UpdateBudgetSchema = z.object({
    monthlyBudget: z.number().positive('Monthly budget must be a positive number')
});

// --- Alert Schemas ---
export const CreateAlertSchema = z.object({
    type: z.string().min(1),
    message: z.string().min(1),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    metadata: z.record(z.any()).optional()
});
// (Most alert ops are read-only or system generated, but if there's a create endpoint for testing/manual)

// --- Reward Schemas ---
export const CreateRewardSchema = z.object({
    cardId: z.string().uuid(),
    points: z.number(),
    description: z.string().optional(),
    expiryDate: z.string().datetime().or(z.date()).optional()
});

export const RedeemRewardSchema = z.object({
    description: z.string().min(1),
    points: z.number().positive()
});

// --- Bill Schemas ---
export const CreateBillSchema = z.object({
    cardId: z.string().uuid(),
    billDate: z.string().datetime().or(z.date()),
    dueDate: z.string().datetime().or(z.date()),
    amount: z.number().positive(),
    minDue: z.number().nonnegative().optional()
});

export const UpdateBillSchema = z.object({
    paymentStatus: z.enum(['paid', 'unpaid', 'partial']).optional(),
    paymentDate: z.string().datetime().or(z.date()).optional(),
    notes: z.string().optional()
});
