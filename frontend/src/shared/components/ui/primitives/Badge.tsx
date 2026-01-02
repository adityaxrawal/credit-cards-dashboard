import React from "react";
import { cn } from "@/shared/utils";
import type { BadgeVariant } from "@/types";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  label?: string;
  variant?: BadgeVariant | "destructive" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const variantStyles = {
  success: "bg-success/20 text-success border-success/30",
  warning: "bg-warning/20 text-warning border-warning/30",
  error: "bg-error/20 text-error border-error/30",
  info: "bg-info/20 text-info border-info/30",
  default: "bg-card-bg text-secondary-text border-muted-text/20",
  destructive: "bg-red-500/20 text-red-700 border-red-500/30 dark:text-red-400",
  secondary:
    "bg-gray-500/20 text-gray-700 border-gray-500/30 dark:text-gray-400",
  outline: "text-gray-950 dark:text-gray-50 border-gray-300",
};

const sizeStyles = {
  sm: "px-2 py-1 text-xs gap-1.5",
  md: "px-3 py-1.5 text-sm gap-2",
  lg: "px-4 py-2 text-base gap-2.5",
};

export function Badge({
  label,
  variant = "default",
  size = "md",
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-medium",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {icon}
      {children || label}
    </span>
  );
}
