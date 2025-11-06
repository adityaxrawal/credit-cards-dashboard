import winston from "winston";

// PII patterns to mask in logs
const PII_PATTERNS = [
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: "[EMAIL]",
  },
  {
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: "[CARD]",
  },
  { pattern: /\b\d{10,12}\b/g, replacement: "[PHONE]" },
  {
    pattern: /"password"\s*:\s*"[^"]*"/gi,
    replacement: '"password":"[REDACTED]"',
  },
  { pattern: /"token"\s*:\s*"[^"]*"/gi, replacement: '"token":"[REDACTED]"' },
];

/**
 * Mask PII in log messages
 */
function maskPII(obj: any): any {
  if (typeof obj === "string") {
    let masked = obj;
    for (const { pattern, replacement } of PII_PATTERNS) {
      masked = masked.replace(pattern, replacement);
    }
    return masked;
  }

  if (Array.isArray(obj)) {
    return obj.map(maskPII);
  }

  if (obj && typeof obj === "object") {
    const masked: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Don't log sensitive fields
      if (["password", "token", "refreshToken", "accessToken"].includes(key)) {
        masked[key] = "[REDACTED]";
      } else {
        masked[key] = maskPII(value);
      }
    }
    return masked;
  }

  return obj;
}

// Create logger instance
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? JSON.stringify(maskPII(meta), null, 2)
      : "";
    return `${timestamp} [${level.toUpperCase()}]: ${maskPII(message)} ${metaStr}`;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: {
    service: "gmail-service",
    environment: process.env.NODE_ENV || "development",
  },
  transports: [
    new winston.transports.Console({
      format:
        process.env.NODE_ENV !== "production"
          ? winston.format.combine(winston.format.colorize(), logFormat)
          : logFormat,
    }),
  ],
});

// Wrapper to mask PII before logging
export const safeLogger = {
  info: (message: string, meta?: any) => {
    logger.info(maskPII(message), maskPII(meta));
  },
  error: (message: string, meta?: any) => {
    logger.error(maskPII(message), maskPII(meta));
  },
  warn: (message: string, meta?: any) => {
    logger.warn(maskPII(message), maskPII(meta));
  },
  debug: (message: string, meta?: any) => {
    logger.debug(maskPII(message), maskPII(meta));
  },
};
