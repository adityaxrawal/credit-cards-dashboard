/**
 * Application Configuration
 * Centralized application settings
 */

export const appConfig = {
  // Server
  port: parseInt(process.env.PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV === "development",
  isTest: process.env.NODE_ENV === "test",

  // URLs
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  apiUrl: process.env.API_URL || "http://localhost:3001",

  // Security
  corsOrigin:
    process.env.CORS_ORIGIN ||
    process.env.FRONTEND_URL ||
    "http://localhost:3000",

  // Encryption
  encryptionKey: process.env.ENCRYPTION_KEY || "",

  // JWT (if using custom auth instead of Supabase)
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",

  // Rate Limiting
  rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
  rateLimitMax: 100,

  // Logging
  logLevel: process.env.LOG_LEVEL || "info",

  // Feature Flags
  features: {
    emailIntegration: process.env.FEATURE_FLAG_EMAIL_INTEGRATION === "true",
    aiInsights: process.env.FEATURE_FLAG_AI_INSIGHTS === "true",
    analytics: process.env.FEATURE_FLAG_ANALYTICS === "true",
  },
} as const;

export type AppConfig = typeof appConfig;
