import React from "react";
import { cn, formatCurrency } from "@/lib/utils";

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  iconColor?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon,
  iconColor = "primary-green",
  trend,
  trendValue,
  onClick,
  className,
}: StatCardProps) {
  const formattedValue =
    typeof value === "number" ? formatCurrency(value) : value;

  const trendColors = {
    up: "text-success",
    down: "text-error",
    neutral: "text-secondary-text",
  };

  return (
    <div
      className={cn(
        "bg-card-bg rounded-xl p-6 transition-all duration-200 card-shadow hover:shadow-lg",
        onClick && "cursor-pointer hover:scale-105",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-secondary-text mb-2">
            {title}
          </p>
          <p className="text-2xl font-bold text-primary-text mb-1">
            {formattedValue}
          </p>
          {trend && trendValue && (
            <div
              className={cn("flex items-center text-sm", trendColors[trend])}
            >
              <span className="mr-1">
                {trend === "up" ? "↗" : trend === "down" ? "↘" : "→"}
              </span>
              {trendValue}
            </div>
          )}
        </div>

        {icon && (
          <div
            className={cn(
              "flex items-center justify-center w-12 h-12 rounded-full bg-opacity-20",
              `bg-${iconColor}`
            )}
          >
            <div className={cn("w-6 h-6", `text-${iconColor}`)}>{icon}</div>
          </div>
        )}
      </div>
    </div>
  );
}
