import { cn } from "@/lib/utils";

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
      <div className={cn("progress-bar", sizeClasses[size])}>
        <div
          className={cn("progress-fill", `bg-${color}`)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
