import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('8000'),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Database (Optional overrides if DATABASE_URL not sufficient, but usually node-postgres uses env vars automatically. 
  // However, for explicit usage we can define them or just rely on DATABASE_URL. 
  // Let's stick to DATABASE_URL as primary, but if the codebase uses others, we add them.)
  // Checking db.ts usage next. For now, just ensuring DATABASE_URL is there is good. 
  // Wait, I should check db.ts first to see what it uses. 
  // If it uses `process.env.PGUSER`, I need to add it.
  // Assuming standard node-postgres `Pool` config, it uses env vars if not provided. 
  // Let's verify db.ts file first.

  // Auth
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  GOOGLE_REDIRECT_URI: z.string().min(1, "GOOGLE_REDIRECT_URI is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Redis
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  GPT_MODEL: z.string().optional().default('gpt-4o-mini'),

  // Gmail
  GMAIL_PUBSUB_TOPIC: z.string().optional(),

  // SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Security
  ENCRYPTION_KEY: z.string().min(32).default('00000000000000000000000000000000'), // Default for dev, override in prod
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
