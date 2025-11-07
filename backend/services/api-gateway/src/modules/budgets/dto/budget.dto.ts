import { z } from "zod";

export const CreateBudgetSchema = z.object({
  category: z.string().min(1),
  amount: z.number().nonnegative(),
  period: z.enum(["monthly", "weekly", "yearly"]),
  startDate: z.string().datetime(),
});

export const UpdateBudgetSchema = CreateBudgetSchema.partial();

export type CreateBudgetRequest = z.infer<typeof CreateBudgetSchema>;
export type UpdateBudgetRequest = z.infer<typeof UpdateBudgetSchema>;
