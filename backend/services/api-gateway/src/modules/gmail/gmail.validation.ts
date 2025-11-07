import { z } from "zod";

/**
 * Gmail Sync Validation Schemas
 */

export const gmailAuthorizeSchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
});

export const gmailSyncSchema = z.object({
  force: z.boolean().optional().default(false),
  maxResults: z.number().int().positive().max(100).optional().default(50),
});
