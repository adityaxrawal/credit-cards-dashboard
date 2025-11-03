import React from "react";
import { cn } from "@/lib/utils";
import type { BadgeVariant } from "@/types";

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const variantStyles = {
  success: "bg-success/20 text-success border-success/30",
  warning: "bg-warning/20 text-warning border-warning/30",
  error: "bg-error/20 text-error border-error/30",
  info: "bg-info/20 text-info border-info/30",
  default: "bg-card-bg text-secondary-text border-muted-text/20",
};

const sizeStyles = {
  sm: "px-2 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
  lg: "px-4 py-2 text-base",
};

export function Badge({
  label,
  variant = "default",
  size = "md",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-medium",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {label}
    </span>
  );
}
