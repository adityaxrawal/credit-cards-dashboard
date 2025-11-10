import { z } from "zod";
import { logger } from "shared/monitoring/logger";

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.string().default("3001"),
    FRONTEND_URL: z.string().url().optional(),

    // Database
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),

    // Security - Enforce minimum key lengths
    ENCRYPTION_KEY: z.string().min(32, "ENCRYPTION_KEY must be at least 32 characters"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),

    // Redis - Required for all environments (except test)
    UPSTASH_REDIS_REST_URL: z.string().url({
      message: "UPSTASH_REDIS_REST_URL must be a valid URL (e.g., https://your-redis.upstash.io)",
    }),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(10, {
      message: "UPSTASH_REDIS_REST_TOKEN is required",
    }),
    USE_IOREDIS: z.string().optional(),
    REDIS_URL: z.string().optional(),

    // Google OAuth (optional, for Gmail sync)
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    // Error Tracking (optional)
    GLITCHTIP_DSN: z.string().url().optional(),
    GLITCHTIP_ENABLED: z.string().optional(),
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ENABLED: z.string().optional(),

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: z.string().default("900000"),
    RATE_LIMIT_MAX: z.string().default("100"),
    RATE_LIMIT_GMAIL_MAX: z.string().default("10"),
    RATE_LIMIT_AUTH_MAX: z.string().default("5"),

    // Logging
    ENABLE_FILE_LOGGING: z.string().optional(),

    // App Metadata
    APP_VERSION: z.string().default("1.0.0"),
  })
  .refine(
    (data) => {
      // Skip Redis validation for test environment only
      if (data.NODE_ENV === "test") {
        return true;
      }
      // For dev/production, Upstash Redis REST API is required
      const hasUpstash = data.UPSTASH_REDIS_REST_URL && data.UPSTASH_REDIS_REST_TOKEN;
      return hasUpstash;
    },
    {
      message:
        "Upstash Redis is required for non-test environments. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN",
    }
  );

export type AppEnv = z.infer<typeof EnvSchema>;

export function validateEnv(): AppEnv {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Fail fast with readable errors
    logger.error("Environment validation failed", new Error("Env validation failed"), {
      details: parsed.error.format(),
    });
    throw new Error("Missing or invalid environment variables. See .env.example");
  }
  return parsed.data;
}
