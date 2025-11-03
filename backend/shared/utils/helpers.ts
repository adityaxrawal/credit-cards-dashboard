import crypto from "crypto";

/**
 * Encrypts a value using AES-256-GCM
 */
export function encryptValue(value: string): string {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }

  const algorithm = "aes-256-gcm";
  const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts a value encrypted with encryptValue
 */
export function decryptValue(encryptedValue: string): string {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }

  const [ivHex, authTagHex, encrypted] = encryptedValue.split(":");
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted value format");
  }

  const algorithm = "aes-256-gcm";
  const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize error message for client response
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    // Don't leak sensitive information
    if (
      error.message.toLowerCase().includes("password") ||
      error.message.toLowerCase().includes("token") ||
      error.message.toLowerCase().includes("secret") ||
      error.message.toLowerCase().includes("key")
    ) {
      return "An authentication error occurred";
    }
    return error.message;
  }
  return "An unexpected error occurred";
}

/**
 * Format currency in INR
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Calculate billing cycle month and year based on card's bill date
 */
export function calculateBillingCycle(
  transactionDate: Date,
  billDate: number
): { month: number; year: number } {
  const txDate = new Date(transactionDate);
  const txDay = txDate.getDate();
  let month = txDate.getMonth() + 1; // 1-12
  let year = txDate.getFullYear();

  // If transaction is before bill date, it belongs to previous billing cycle
  if (txDay < billDate) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }

  return { month, year };
}

/**
 * Calculate days until a specific day of month
 */
export function daysUntilDayOfMonth(dayOfMonth: number): number {
  const today = new Date();
  const targetDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    dayOfMonth
  );

  if (targetDate < today) {
    targetDate.setMonth(targetDate.getMonth() + 1);
  }

  const diffInMs = targetDate.getTime() - today.getTime();
  return Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
}

/**
 * Generate a random alphanumeric string
 */
export function generateRandomString(length: number = 32): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry async function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
