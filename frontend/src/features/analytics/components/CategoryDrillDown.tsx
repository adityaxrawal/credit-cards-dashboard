"use client";

import React, { useState } from "react";
import { ChevronRight, ChevronDown, TrendingUp, TrendingDown, Download } from "lucide-react";
import { cn, formatCurrency } from "@/shared/utils";

interface DrillDownCategory {
  name: string;
  total: number;
  count: number;
  change?: number; // percentage change from previous period
  subcategories?: DrillDownCategory[];
  transactions?: Array<{
    id: string;
    merchant: string;
    amount: number;
    date: Date;
  }>;
}

interface CategoryDrillDownProps {
  categories: DrillDownCategory[];
  onViewTransactions?: (category: string) => void;
  comparisonPeriod?: string;
  onExport?: () => void;
}

export function CategoryDrillDown({
  categories,
  onViewTransactions,
  comparisonPeriod = "last month",
  onExport,
}: CategoryDrillDownProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const grandTotal = categories.reduce((sum, cat) => sum + cat.total, 0);

  return (
    <div className="bg-card-bg rounded-xl border border-muted-text/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-muted-text/10 bg-hover-bg/50">
        <div className="flex items-center gap-4">
          <span className="font-medium text-primary-text">Category</span>
          {onExport && (
            <button 
              onClick={(e) => {
                e.preventDefault();
                onExport();
              }}
              className="p-1 hover:bg-hover-bg rounded-md text-secondary-text hover:text-primary-text transition-colors" 
              title="Export Report"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-6 text-sm text-secondary-text">
          <span className="w-24 text-right">Amount</span>
          <span className="w-16 text-right">Count</span>
          <span className="w-20 text-right">vs {comparisonPeriod}</span>
        </div>
      </div>

      {/* Categories */}
      <div className="divide-y divide-muted-text/5">
        {categories.map((category) => {
          const isExpanded = expandedCategories.has(category.name);
          const percentage = grandTotal > 0 ? (category.total / grandTotal) * 100 : 0;

          return (
            <div key={category.name}>
              {/* Main Category Row */}
              <button
                onClick={() => category.subcategories && toggleCategory(category.name)}
                className={cn(
                  "w-full flex items-center justify-between p-4 text-left transition-colors",
                  category.subcategories ? "hover:bg-hover-bg cursor-pointer" : "cursor-default"
                )}
              >
                <div className="flex items-center gap-3">
                  {category.subcategories ? (
                    isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-secondary-text" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-secondary-text" />
                    )
                  ) : (
                    <div className="w-4" />
                  )}
                  <div>
                    <span className="font-medium text-primary-text">{category.name}</span>
                    <div className="w-32 h-1.5 bg-hover-bg rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <span className="w-24 text-right font-medium text-primary-text">
                    {formatCurrency(category.total)}
                  </span>
                  <span className="w-16 text-right text-secondary-text">
                    {category.count}
                  </span>
                  <span className="w-20 text-right">
                    {category.change !== undefined && (
                      <span className={cn(
                        "flex items-center justify-end gap-1",
                        category.change > 0 ? "text-error" : category.change < 0 ? "text-success" : "text-muted-text"
                      )}>
                        {category.change > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : category.change < 0 ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : null}
                        {category.change > 0 ? "+" : ""}{category.change}%
                      </span>
                    )}
                  </span>
                </div>
              </button>

              {/* Subcategories */}
              {isExpanded && category.subcategories && (
                <div className="bg-hover-bg/30">
                  {category.subcategories.map((sub) => (
                    <button
                      key={sub.name}
                      onClick={() => onViewTransactions?.(sub.name)}
                      className="w-full flex items-center justify-between p-3 pl-12 text-left hover:bg-hover-bg transition-colors"
                    >
                      <span className="text-secondary-text">{sub.name}</span>
                      <div className="flex items-center gap-6 text-sm">
                        <span className="w-24 text-right text-primary-text">
                          {formatCurrency(sub.total)}
                        </span>
                        <span className="w-16 text-right text-muted-text">
                          {sub.count}
                        </span>
                        <span className="w-20 text-right">
                          {sub.change !== undefined && (
                            <span className={cn(
                              sub.change > 0 ? "text-error" : sub.change < 0 ? "text-success" : "text-muted-text"
                            )}>
                              {sub.change > 0 ? "+" : ""}{sub.change}%
                            </span>
                          )}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Total */}
      <div className="flex items-center justify-between p-4 border-t border-muted-text/10 bg-hover-bg/50">
        <span className="font-semibold text-primary-text">Total</span>
        <div className="flex items-center gap-6 text-sm">
          <span className="w-24 text-right font-semibold text-primary-text">
            {formatCurrency(grandTotal)}
          </span>
          <span className="w-16 text-right text-secondary-text">
            {categories.reduce((sum, cat) => sum + cat.count, 0)}
          </span>
          <span className="w-20" />
        </div>
      </div>
    </div>
  );
}
