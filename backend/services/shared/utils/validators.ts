/**
 * Validators Utility Module
 * Consolidated validation functions for the application
 */

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (Indian format)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate date range
 */
export function isValidDateRange(startDate: Date, endDate: Date): boolean {
  return startDate <= endDate;
}

/**
 * Validate day of month (1-31)
 */
export function isValidDayOfMonth(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= 31;
}

/**
 * Validate amount (positive number)
 */
export function isValidAmount(amount: number): boolean {
  return typeof amount === "number" && amount > 0 && isFinite(amount);
}

/**
 * Validate percentage (0-100)
 */
export function isValidPercentage(value: number): boolean {
  return typeof value === "number" && value >= 0 && value <= 100 && isFinite(value);
}

/**
 * Validate credit limit
 */
export function isValidCreditLimit(limit: number): boolean {
  return typeof limit === "number" && limit > 0 && isFinite(limit);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate card number (Luhn algorithm)
 */
export function isValidCardNumber(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");

  if (digits.length < 13 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Validate CVV
 */
export function isValidCVV(cvv: string): boolean {
  return /^\d{3,4}$/.test(cvv);
}

/**
 * Validate expiry date (MM/YY format)
 */
export function isValidExpiryDate(expiry: string): boolean {
  if (!/^\d{2}\/\d{2}$/.test(expiry)) {
    return false;
  }

  const [month, year] = expiry.split("/").map(Number);

  if (month < 1 || month > 12) {
    return false;
  }

  const now = new Date();
  const currentYear = now.getFullYear() % 100; // Last 2 digits
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return false;
  }

  return true;
}

/**
 * Validate transaction category
 */
export function isValidCategory(category: string): boolean {
  const validCategories = [
    "groceries",
    "dining",
    "shopping",
    "travel",
    "entertainment",
    "bills",
    "fuel",
    "healthcare",
    "education",
    "others",
  ];
  return validCategories.includes(category.toLowerCase());
}

/**
 * Validate password strength
 */
export function isStrongPassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[@$!%*?&#]/.test(password)) {
    errors.push("Password must contain at least one special character (@$!%*?&#)");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
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
