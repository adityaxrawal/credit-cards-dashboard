import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
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
