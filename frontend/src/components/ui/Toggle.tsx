import React from "react";
import { cn } from "@/lib/utils";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  className,
}: ToggleProps) {
  const toggleId = React.useId();

  return (
    <div className={cn("flex items-center", className)}>
      <button
        type="button"
        role="switch"
        id={toggleId}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-green focus-visible:ring-offset-2 focus-visible:ring-offset-primary-bg disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary-green" : "bg-muted-text/30"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
      {label && (
        <label
          htmlFor={toggleId}
          className={cn(
            "ml-3 text-sm font-medium text-primary-text cursor-pointer",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          {label}
        </label>
      )}
    </div>
  );
}
