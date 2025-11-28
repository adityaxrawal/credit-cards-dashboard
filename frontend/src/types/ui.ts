/**
 * UI Component Types
 * Types for UI components, modals, toasts, and visual elements
 */

/**
 * Modal size variants
 */
export type ModalSize = "sm" | "md" | "lg" | "xl";

/**
 * Button style variants
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "error"
  | "info";

/**
 * Badge style variants
 */
export type BadgeVariant = "success" | "warning" | "error" | "info" | "default";

/**
 * Toast notification severity
 */
export type ToastType = "success" | "error" | "warning" | "info";

/**
 * Toast notification
 */
export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}
