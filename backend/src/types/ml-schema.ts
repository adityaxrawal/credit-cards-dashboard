import { z } from 'zod';

export const MlTransactionSchema = z.object({
    isTransaction: z.boolean(),
    category: z.enum(['transaction_success', 'refund', 'statement', 'otp', 'non_transaction']),
    merchant: z.string().nullable(),
    amount: z.number().nullable(),
    currency: z.string().nullable().describe("ISO 4217 Currency Code (e.g. INR, USD) or null"),
    transactionDate: z.string().nullable().describe("ISO 8601 Date String or null"),
    cardLast4: z.string().nullable(),
    confidence: z.number().min(0).max(1)
});

export type MlTransaction = z.infer<typeof MlTransactionSchema>;

export interface MLClassificationResult extends MlTransaction {
    error?: string;
    rawResponse?: string;
}

export function safeParseMLOutput(data: unknown): { success: boolean; data: MLClassificationResult; error?: z.ZodError } {
    try {
        const result = MlTransactionSchema.parse(data);
        return { success: true, data: result };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, data: {} as any, error };
        }
        return { success: false, data: {} as any, error: new z.ZodError([]) };
    }
}
