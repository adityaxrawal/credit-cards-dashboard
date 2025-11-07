import rateLimit from "express-rate-limit";

// Global defaults come from env in index.ts; these are specialized limiters.

export const gmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_GMAIL_MAX || "10", 10),
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || "20", 10),
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper to create per-route custom limiters if needed later
export function createLimiter(windowMs: number, max: number) {
  return rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false });
}
