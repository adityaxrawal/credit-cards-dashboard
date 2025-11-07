import { z } from "zod";

export const GmailAuthorizeSchema = z.object({
  code: z.string().min(4),
});

export type GmailAuthorizeRequest = z.infer<typeof GmailAuthorizeSchema>;
