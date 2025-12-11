/**
 * Zod Validation Schemas
 * Gmail-Powered Credit Card Transaction Tracking System
 * Per spec Section 8.1: Input Validation
 */

import { z } from 'zod';

// ============================================
// Common Schemas
// ============================================

export const UuidSchema = z.string().uuid();

export const PaginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const DateRangeSchema = z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
});

// ============================================
// Transaction Schemas
// ============================================

export const CreateTransactionSchema = z.object({
    cardId: z.string().uuid(),
    transactionDate: z.coerce.date(),
    merchant: z.string().min(1).max(255),
    category: z.string().min(1).max(100),
    amount: z.number().positive().max(10000000),
    transactionType: z.enum(['debit', 'credit', 'refund']),
    description: z.string().max(500).optional(),
});

export const UpdateTransactionSchema = z.object({
    merchant: z.string().min(1).max(255).optional(),
    category: z.string().min(1).max(100).optional(),
    amount: z.number().positive().max(10000000).optional(),
    transactionType: z.enum(['debit', 'credit', 'refund']).optional(),
    description: z.string().max(500).optional(),
});

export const TransactionFiltersSchema = z.object({
    cardId: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    billMonth: z.coerce.number().int().min(1).max(12).optional(),
    billYear: z.coerce.number().int().min(2020).max(2099).optional(),
    category: z.string().optional(),
    transactionType: z.enum(['debit', 'credit', 'refund']).optional(),
    merchant: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ============================================
// Card Schemas
// ============================================

export const CreateCardSchema = z.object({
    cardName: z.string().min(1).max(255),
    bankName: z.string().min(1).max(100),
    lastFour: z.string().length(4).regex(/^\d{4}$/),
    billDate: z.number().int().min(1).max(31),
    dueDate: z.number().int().min(1).max(31),
    creditLimit: z.number().positive(),
    activationDate: z.coerce.date().optional(),
    notes: z.string().max(500).optional(),
});

export const UpdateCardSchema = z.object({
    cardName: z.string().min(1).max(255).optional(),
    bankName: z.string().min(1).max(100).optional(),
    billDate: z.number().int().min(1).max(31).optional(),
    dueDate: z.number().int().min(1).max(31).optional(),
    creditLimit: z.number().positive().optional(),
    notes: z.string().max(500).optional(),
});

export const CardStatementQuerySchema = z.object({
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2020).max(2099),
});

// ============================================
// Gmail Schemas
// ============================================

export const GmailConnectSchema = z.object({
    refreshToken: z.string().min(1),
});

export const HistoricalScanSchema = z.object({
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
});

export const ManualMapSchema = z.object({
    messageId: z.string().min(1),
    cardInfo: z.object({
        last4: z.string().length(4).regex(/^\d{4}$/),
        bankName: z.string().min(1),
    }),
});

// ============================================
// Budget Schemas
// ============================================

export const CreateBudgetSchema = z.object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2020).max(2099),
    amount: z.number().positive(),
});

export const UpdateBudgetSchema = z.object({
    amount: z.number().positive(),
});

// ============================================
// Auth Schemas
// ============================================

export const GoogleLoginSchema = z.object({
    code: z.string().min(1),
});

export const RefreshTokenSchema = z.object({
    refreshToken: z.string().optional(), // Can come from cookie
});

// ============================================
// Alerts Schemas
// ============================================

export const AlertsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    unreadOnly: z.coerce.boolean().default(false),
});

// ============================================
// Rewards Schemas
// ============================================

export const SuggestCardQuerySchema = z.object({
    merchant: z.string().min(1),
    amount: z.coerce.number().positive(),
});

// Export types
export type CreateTransaction = z.infer<typeof CreateTransactionSchema>;
export type UpdateTransaction = z.infer<typeof UpdateTransactionSchema>;
export type CreateCard = z.infer<typeof CreateCardSchema>;
export type UpdateCard = z.infer<typeof UpdateCardSchema>;
export type CreateBudget = z.infer<typeof CreateBudgetSchema>;
