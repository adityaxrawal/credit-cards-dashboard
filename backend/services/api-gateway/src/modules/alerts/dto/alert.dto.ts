import { z } from "zod";

export const CreateAlertSchema = z.object({
  type: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  channel: z.array(z.enum(["email", "sms", "push"])).min(1),
  message: z.string().min(5).max(500),
});

export const UpdateAlertSchema = CreateAlertSchema.partial();

export type CreateAlertRequest = z.infer<typeof CreateAlertSchema>;
export type UpdateAlertRequest = z.infer<typeof UpdateAlertSchema>;
