/**
 * Formatters Utility Module
 * Consolidated formatting functions for the application
 */

/**
 * Format currency in INR
 */
export function formatCurrency(
  amount: number,
  options?: {
    showDecimals?: boolean;
    compact?: boolean;
  }
): string {
  const { showDecimals = false, compact = false } = options || {};

  if (compact && Math.abs(amount) >= 100000) {
    const value = amount / 100000;
    return `₹${value.toFixed(showDecimals ? 2 : 1)}L`;
  }

  if (compact && Math.abs(amount) >= 1000) {
    const value = amount / 1000;
    return `₹${value.toFixed(showDecimals ? 2 : 1)}K`;
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(amount);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format date to DD/MM/YYYY
 */
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format date to relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
  if (diffMonths < 12) return `${diffMonths} ${diffMonths === 1 ? "month" : "months"} ago`;
  return `${diffYears} ${diffYears === 1 ? "year" : "years"} ago`;
}

/**
 * Format month name
 */
export function formatMonthName(month: number, year?: number, short = false): string {
  const date = new Date(year || new Date().getFullYear(), month - 1);
  return date.toLocaleDateString("en-US", {
    month: short ? "short" : "long",
    year: year ? "numeric" : undefined,
  });
}

/**
 * Format uptime duration
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format card number (last 4 digits)
 */
export function formatCardNumber(cardNumber: string, maskAll = false): string {
  const cleaned = cardNumber.replace(/\D/g, "");

  if (maskAll) {
    return `**** **** **** ${cleaned.slice(-4)}`;
  }

  return `****${cleaned.slice(-4)}`;
}

/**
 * Format phone number (Indian)
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }

  return phone;
}

/**
 * Capitalize first letter of each word
 */
export function capitalize(text: string): string {
  return text
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Format transaction description
 */
export function formatTransactionDescription(description: string): string {
  // Remove excessive spaces and special characters
  let formatted = description.trim().replace(/\s+/g, " ");

  // Limit length
  if (formatted.length > 50) {
    formatted = formatted.slice(0, 47) + "...";
  }

  return formatted;
}

/**
 * Format status badge text
 */
export function formatStatus(status: string): string {
  return status.replace(/_/g, " ").toUpperCase();
}

/**
 * Format number with commas (Indian numbering system)
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-IN").format(num);
}
