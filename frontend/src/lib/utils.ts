import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Re-export formatCurrency from shared/utils for consistency
 * This ensures all currency formatting uses the user's selected display currency
 */
export { formatCurrency, formatOriginalCurrency, setDisplayCurrency, getDisplayCurrency } from "@/shared/utils";

/**
 * Format date in various formats
 */
export function formatDate(
  date: string | Date,
  format: "short" | "long" | "relative" = "short"
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  switch (format) {
    case "short":
      return dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    case "long":
      return dateObj.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    case "relative": {
      const now = new Date();
      const diff = now.getTime() - dateObj.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days === 0) return "Today";
      if (days === 1) return "Yesterday";
      if (days < 7) return `${days} days ago`;
      if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
      if (days < 365) return `${Math.floor(days / 30)} months ago`;
      return `${Math.floor(days / 365)} years ago`;
    }
    default:
      return dateObj.toLocaleDateString();
  }
}

/**
 * Get gradient class for card brand
 */
export function getCardGradient(brand: string): string {
  const gradients: Record<string, string> = {
    visa: "from-blue-600 to-blue-800",
    mastercard: "from-red-600 to-orange-600",
    amex: "from-blue-500 to-cyan-600",
    discover: "from-orange-500 to-orange-700",
    default: "from-gray-700 to-gray-900",
  };
  return gradients[brand.toLowerCase()] || gradients.default;
}

/**
 * Calculate credit card utilization percentage
 */
export function calculateUtilization(balance: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.round((balance / limit) * 100);
}

/**
 * Mask card number for display
 */
export function maskCardNumber(cardNumber: string): string {
  if (!cardNumber || cardNumber.length < 4) return cardNumber;
  const last4 = cardNumber.slice(-4);
  return `•••• ${last4}`;
}
