import pino from "pino";

// PII patterns to mask in logs
const PII_PATTERNS = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: "[EMAIL]" },
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: "[CARD]" },
  { pattern: /\b\d{10,12}\b/g, replacement: "[PHONE]" },
  { pattern: /"password"\s*:\s*"[^"]*"/gi, replacement: '"password":"[REDACTED]"' },
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
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
  redact: {
    paths: [
      "*.password",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.gmail_refresh_token",
      "*.gmail_access_token",
    ],
    remove: true,
  },
  transport:
    process.env.NODE_ENV !== "production"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  base:
    process.env.NODE_ENV === "production"
      ? {
          service: "gmail-service",
          environment: process.env.NODE_ENV,
        }
      : undefined,
});

// Wrapper to mask PII before logging
export const safeLogger = {
  info: (obj: any, msg?: string) => {
    logger.info(maskPII(obj), msg);
  },
  error: (obj: any, msg?: string) => {
    logger.error(maskPII(obj), msg);
  },
  warn: (obj: any, msg?: string) => {
    logger.warn(maskPII(obj), msg);
  },
  debug: (obj: any, msg?: string) => {
    logger.debug(maskPII(obj), msg);
  },
};
