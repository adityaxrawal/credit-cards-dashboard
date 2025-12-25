import React from "react";
import { cn } from "@/lib/utils";
import { Progress } from "./progress";

export interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  showPercentage?: boolean;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ProgressBar({
  value,
  max,
  label,
  showPercentage = true,
  color = "primary-green",
  size = "md",
  className,
}: ProgressBarProps) {
  const percentage = max === 0 ? 0 : Math.round((value / max) * 100);

  const sizeClasses = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4",
  };

  // Map legacy color props to tailwind classes if needed, or rely on default
  // For now, we'll use a specific class for the indicator based on the color prop
  // assuming 'primary-green' maps to 'bg-primary-green'
  const indicatorColorClass = color === "primary-green" ? "bg-primary-green" : `bg-${color}`;

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-primary-text">{label}</span>
          {showPercentage && (
            <span className="text-sm text-secondary-text">{percentage}%</span>
          )}
        </div>
      )}
      <Progress 
        value={percentage} 
        className={sizeClasses[size]} 
        indicatorClassName={indicatorColorClass}
      />
    </div>
  );
}
