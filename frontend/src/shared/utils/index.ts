import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Global display currency store
 * This is set by the CurrencyProvider and used by formatCurrency
 */
let _displayCurrency = "INR";
let _displayLocale = "en-IN";
let _displayDecimals = 0;

/**
 * Currency metadata for formatting
 */
const CURRENCY_CONFIG: Record<string, { locale: string; decimals: number }> = {
  INR: { locale: "en-IN", decimals: 0 },
  USD: { locale: "en-US", decimals: 2 },
  EUR: { locale: "de-DE", decimals: 2 },
  GBP: { locale: "en-GB", decimals: 2 },
  AED: { locale: "ar-AE", decimals: 2 },
  SGD: { locale: "en-SG", decimals: 2 },
  CAD: { locale: "en-CA", decimals: 2 },
  AUD: { locale: "en-AU", decimals: 2 },
  JPY: { locale: "ja-JP", decimals: 0 },
  CHF: { locale: "de-CH", decimals: 2 },
  CNY: { locale: "zh-CN", decimals: 2 },
  HKD: { locale: "zh-HK", decimals: 2 },
  NZD: { locale: "en-NZ", decimals: 2 },
  THB: { locale: "th-TH", decimals: 2 },
  MYR: { locale: "ms-MY", decimals: 2 },
};

/**
 * Set the global display currency (called by CurrencyProvider)
 */
export function setDisplayCurrency(currency: string): void {
  _displayCurrency = currency;
  const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.INR;
  _displayLocale = config.locale;
  _displayDecimals = config.decimals;
}

/**
 * Get the current display currency
 */
export function getDisplayCurrency(): string {
  return _displayCurrency;
}

/**
 * Format an amount in the user's selected display currency
 * @param amount - The amount to format (assumed to already be in display currency)
 * @param currencyOverride - Optional: override the display currency for this call
 */
export function formatCurrency(amount: number, currencyOverride?: string): string {
  const currency = currencyOverride || _displayCurrency;
  const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.INR;

  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(amount);
}

/**
 * Format amount with explicit source currency
 * Use this when you need to show the original amount in its original currency
 */
export function formatOriginalCurrency(amount: number, sourceCurrency: string): string {
  const currency = sourceCurrency || "INR";
  const config = CURRENCY_CONFIG[currency] || { locale: "en-US", decimals: 2 };

  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(amount);
}

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
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    case "relative":
      return formatRelativeTime(dateObj);
    default:
      return dateObj.toLocaleDateString();
  }
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return formatDate(date, "short");
}

export function maskCardNumber(cardNumber: string): string {
  if (cardNumber.length < 4) return cardNumber;
  const lastFour = cardNumber.slice(-4);
  return `**** **** **** ${lastFour}`;
}

export function calculateUtilization(
  currentBalance: number,
  creditLimit: number
): number {
  if (creditLimit === 0) return 0;
  return Math.round((currentBalance / creditLimit) * 100);
}

export function getCardGradient(index: number): string {
  const gradients = [
    "gradient-purple",
    "gradient-orange",
    "gradient-green",
    "gradient-blue",
  ];
  return gradients[index % gradients.length];
}

export function getBadgeVariant(
  type: string
): "success" | "warning" | "error" | "info" | "default" {
  switch (type.toLowerCase()) {
    case "settled":
    case "active":
    case "success":
      return "success";
    case "pending":
    case "warning":
      return "warning";
    case "failed":
    case "error":
    case "inactive":
      return "error";
    case "info":
      return "info";
    default:
      return "default";
  }
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function validateCardNumber(cardNumber: string): boolean {
  const cleaned = cardNumber.replace(/\s/g, "");
  return /^\d{4}$/.test(cleaned);
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function getNextBillDate(billDate: number): Date {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let nextBillMonth = currentMonth;
  let nextBillYear = currentYear;

  const thisMonthBillDate = new Date(currentYear, currentMonth, billDate);

  if (thisMonthBillDate <= today) {
    nextBillMonth = currentMonth + 1;
    if (nextBillMonth > 11) {
      nextBillMonth = 0;
      nextBillYear = currentYear + 1;
    }
  }

  return new Date(nextBillYear, nextBillMonth, billDate);
}

export function getDaysUntilBill(billDate: number): number {
  const nextBill = getNextBillDate(billDate);
  const today = new Date();
  const diffTime = nextBill.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
