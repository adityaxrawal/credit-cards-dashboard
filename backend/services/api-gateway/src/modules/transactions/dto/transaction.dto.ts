import { z } from "zod";

export const CreateTransactionSchema = z.object({
  cardId: z.string().uuid().optional(),
  transactionDate: z.string().datetime(),
  merchantName: z.string().min(1),
  merchantCategory: z.string().min(1),
  amount: z.number().positive(),
  transactionType: z.enum(["purchase", "refund", "payment"]),
  description: z.string().max(250).optional(),
});

export type CreateTransactionRequest = z.infer<typeof CreateTransactionSchema>;
