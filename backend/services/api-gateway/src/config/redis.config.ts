/**
 * Redis Configuration
 * Cache and session storage settings
 */

export const redisConfig = {
  // Upstash Redis REST API
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",

  // Cache settings
  defaultTtl: 3600, // 1 hour in seconds
  keyPrefix: "cc-dashboard:",

  // Session settings
  sessionTtl: 7 * 24 * 60 * 60, // 7 days in seconds
  sessionPrefix: "session:",

  // Retry settings
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
} as const;

export type RedisConfig = typeof redisConfig;
