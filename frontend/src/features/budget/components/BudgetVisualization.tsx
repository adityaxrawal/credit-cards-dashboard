"use client";

import React from "react";
import { cn, formatCurrency } from "@/shared/utils";
import { TrendingUp, TrendingDown, Target, AlertTriangle } from "lucide-react";

interface BudgetCategory {
  category: string;
  budget: number;
  spent: number;
  color?: string;
}

interface BudgetVisualizationProps {
  totalBudget: number;
  totalSpent: number;
  categories: BudgetCategory[];
  alertThresholds?: number[]; // percentages like [50, 80, 100]
  onCategoryClick?: (category: string) => void;
}

export function BudgetVisualization({
  totalBudget,
  totalSpent,
  categories,
  alertThresholds = [50, 80, 100],
  onCategoryClick,
}: BudgetVisualizationProps) {
  const overallRatio = totalBudget > 0 ? totalSpent / totalBudget : 0;
  const overallPercentage = Math.round(overallRatio * 100);
  const remaining = totalBudget - totalSpent;

  const getBarColor = (ratio: number) => {
    if (ratio >= 1) return "bg-error";
    if (ratio >= 0.8) return "bg-warning";
    return "bg-success";
  };

  const getTextColor = (ratio: number) => {
    if (ratio >= 1) return "text-error";
    if (ratio >= 0.8) return "text-warning";
    return "text-success";
  };

  return (
    <div className="space-y-6">
      {/* Overall Budget Summary */}
      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              overallRatio >= 0.8 ? "bg-warning/10" : "bg-success/10"
            )}>
              <Target className={cn(
                "w-5 h-5",
                overallRatio >= 0.8 ? "text-warning" : "text-success"
              )} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-primary-text">Monthly Budget</h3>
              <p className="text-sm text-secondary-text">
                {overallPercentage}% used
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary-text">
              {formatCurrency(totalSpent)}
            </p>
            <p className="text-sm text-secondary-text">
              of {formatCurrency(totalBudget)}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative h-4 bg-hover-bg rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all duration-500", getBarColor(overallRatio))}
            style={{ width: `${Math.min(overallPercentage, 100)}%` }}
          />
          {/* Threshold markers */}
          {alertThresholds.map((threshold) => (
            <div
              key={threshold}
              className="absolute top-0 bottom-0 w-0.5 bg-muted-text/30"
              style={{ left: `${threshold}%` }}
            />
          ))}
        </div>

        {/* Remaining */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            {remaining >= 0 ? (
              <>
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="text-sm text-success font-medium">
                  {formatCurrency(remaining)} remaining
                </span>
              </>
            ) : (
              <>
                <TrendingDown className="w-4 h-4 text-error" />
                <span className="text-sm text-error font-medium">
                  {formatCurrency(Math.abs(remaining))} over budget
                </span>
              </>
            )}
          </div>
          {overallRatio >= 0.8 && overallRatio < 1 && (
            <div className="flex items-center gap-1 text-warning text-sm">
              <AlertTriangle className="w-4 h-4" />
              Approaching limit
            </div>
          )}
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10">
        <h3 className="text-lg font-semibold text-primary-text mb-4">By Category</h3>
        
        <div className="space-y-4">
          {categories.map((cat) => {
            const ratio = cat.budget > 0 ? cat.spent / cat.budget : 0;
            const percentage = Math.round(ratio * 100);

            return (
              <button
                key={cat.category}
                onClick={() => onCategoryClick?.(cat.category)}
                className="w-full text-left hover:bg-hover-bg rounded-lg p-3 -m-3 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-primary-text">{cat.category}</span>
                  <span className={cn("text-sm font-medium", getTextColor(ratio))}>
                    {formatCurrency(cat.spent)} / {formatCurrency(cat.budget)}
                  </span>
                </div>
                <div className="h-2 bg-hover-bg rounded-full overflow-hidden">
                  <div
                    className={cn("h-full transition-all", cat.color || getBarColor(ratio))}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-text mt-1">
                  <span>{percentage}%</span>
                  {ratio < 1 && (
                    <span>{formatCurrency(cat.budget - cat.spent)} left</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Alert Thresholds Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-secondary-text">
        {alertThresholds.map((threshold, i) => (
          <div key={threshold} className="flex items-center gap-1">
            <div className={cn(
              "w-3 h-3 rounded-full",
              i === 0 ? "bg-success" : i === 1 ? "bg-warning" : "bg-error"
            )} />
            <span>{threshold}% threshold</span>
          </div>
        ))}
      </div>
    </div>
  );
}
