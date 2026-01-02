import { z } from 'zod';

export const CreateTransactionSchema = z.object({
    amount: z.number().positive('Amount must be positive'),
    merchant: z.string().min(1, 'Merchant name is required').max(255),
    date: z.string().datetime().or(z.date()).optional(), // Legacy support
    transactionDate: z.string().datetime().or(z.date()),
    category: z.string().min(1, 'Category is required'),
    transactionType: z.enum(['debit', 'credit']),
    cardId: z.string().uuid().optional(),
    instrumentId: z.string().uuid().optional(),
    instrumentType: z.string().optional(),
    description: z.string().optional(),
    direction: z.enum(['debit', 'credit']).optional(),
    parentTransactionId: z.string().uuid().optional()
}).refine(data => data.instrumentId || data.cardId, {
    message: "Either instrumentId or cardId is required",
    path: ["instrumentId"]
});

export const UpdateTransactionSchema = z.object({
    amount: z.number().positive().optional(),
    merchant: z.string().min(1).max(255).optional(),
    category: z.string().min(1).optional(),
    description: z.string().optional(),
    transactionType: z.enum(['debit', 'credit']).optional(),
    isSettled: z.boolean().optional(),
    needsReview: z.boolean().optional(),
    classificationMethod: z.string().optional()
});
