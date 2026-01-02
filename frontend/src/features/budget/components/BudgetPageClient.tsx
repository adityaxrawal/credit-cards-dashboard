"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency, cn } from "@/shared/utils";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { Card } from "@/shared/components/ui";
import { budgetApi, CategoryBudget } from "@/features/budget/api";

// Color palette for categories
const CATEGORY_COLORS: Record<string, string> = {
    "Housing": "#8b5cf6",
    "Food & Dining": "#f43f5e",
    "Transportation": "#06b6d4",
    "Shopping": "#f59e0b",
    "Utilities": "#10b981",
    "Entertainment": "#ec4899",
    "Healthcare": "#14b8a6",
    "Education": "#6366f1",
    "Travel": "#0ea5e9",
    "Other": "#9ca3af",
};

const getCategoryColor = (category: string, index: number): string => {
    if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
    // Generate a color based on index for unknown categories
    const colors = ["#8b5cf6", "#f43f5e", "#06b6d4", "#f59e0b", "#10b981", "#ec4899", "#14b8a6", "#6366f1"];
    return colors[index % colors.length];
};

export default function BudgetPageClient() {
    // Fetch category budgets from API
    const { data: categoryBudgets, isLoading: categoriesLoading, error: categoriesError } = useQuery({
        queryKey: ['budget-categories'],
        queryFn: budgetApi.getCategoryBudgets,
    });

    // Fetch overall budget status
    const { data: budgetStatus, isLoading: statusLoading } = useQuery({
        queryKey: ['budget-current'],
        queryFn: budgetApi.getCurrentBudget,
    });

    const isLoading = categoriesLoading || statusLoading;

    // Calculate totals from category budgets if available, otherwise use budget status
    const categories = categoryBudgets || [];
    const totalSpent = categories.length > 0 
        ? categories.reduce((a, b) => a + (b.spent || 0), 0)
        : (budgetStatus?.spent || 0);
    const totalLimit = categories.length > 0 
        ? categories.reduce((a, b) => a + (b.budgetLimit || 0), 0)
        : (budgetStatus?.monthlyBudget || 0);
    const totalPercent = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

    if (isLoading) {
        return (
            <div className="space-y-8 max-w-5xl mx-auto animate-pulse">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="space-y-2">
                        <div className="h-8 bg-muted-text/10 rounded w-48"></div>
                        <div className="h-4 bg-muted-text/10 rounded w-64"></div>
                    </div>
                    <div className="w-32 h-32 bg-muted-text/10 rounded-full"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 bg-muted-text/10 rounded-xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (categoriesError) {
        return (
            <div className="space-y-8 max-w-5xl mx-auto">
                <div className="text-center py-12">
                    <p className="text-error mb-2">Failed to load budget data</p>
                    <p className="text-secondary-text text-sm">Please try refreshing the page</p>
                </div>
            </div>
        );
    }

    // If no category budgets, show empty state with overall budget
    if (categories.length === 0) {
        return (
            <div className="space-y-8 max-w-5xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    <div>
                       <h1 className="text-3xl font-bold text-primary-text mb-2">Monthly Budget</h1>
                       {budgetStatus ? (
                           <p className="text-secondary-text">
                               You have spent <span className="text-primary-text font-bold">{formatCurrency(budgetStatus.spent)}</span> of your {formatCurrency(budgetStatus.monthlyBudget)} limit.
                           </p>
                       ) : (
                           <p className="text-secondary-text">No budget set for this month.</p>
                       )}
                    </div>
                    
                    {budgetStatus && (
                        <div className="relative w-32 h-32">
                             <PieChart width={128} height={128}>
                                <Pie
                                    data={[{ value: budgetStatus.spent }, { value: Math.max(0, budgetStatus.monthlyBudget - budgetStatus.spent) }]}
                                    cx={60}
                                    cy={60}
                                    innerRadius={40}
                                    outerRadius={50}
                                    startAngle={90}
                                    endAngle={-270}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    <Cell fill={budgetStatus.ratio > 100 ? "#ef4444" : "#10b981"} />
                                    <Cell fill="#334155" />
                                </Pie>
                             </PieChart>
                             <div className="absolute inset-0 flex items-center justify-center -ml-2 -mt-2">
                                 <span className="text-lg font-bold text-primary-text">{Math.round(budgetStatus.ratio)}%</span>
                             </div>
                        </div>
                    )}
                </div>

                <div className="text-center py-8 border border-dashed border-border rounded-xl">
                    <p className="text-secondary-text">No category budgets configured.</p>
                    <p className="text-sm text-muted-text mt-1">Set up category-wise budgets to track spending by category.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                <div>
                   <h1 className="text-3xl font-bold text-primary-text mb-2">Monthly Budget</h1>
                   <p className="text-secondary-text">You have spent <span className="text-primary-text font-bold">{formatCurrency(totalSpent)}</span> of your {formatCurrency(totalLimit)} limit.</p>
                </div>
                
                {/* Total Ring Chart */}
                <div className="relative w-32 h-32">
                     <PieChart width={128} height={128}>
                        <Pie
                            data={[{ value: totalSpent }, { value: Math.max(0, totalLimit - totalSpent) }]}
                            cx={60}
                            cy={60}
                            innerRadius={40}
                            outerRadius={50}
                            startAngle={90}
                            endAngle={-270}
                            dataKey="value"
                            stroke="none"
                        >
                            <Cell fill={totalPercent > 100 ? "#ef4444" : "#10b981"} />
                            <Cell fill="#334155" />
                        </Pie>
                     </PieChart>
                     <div className="absolute inset-0 flex items-center justify-center -ml-2 -mt-2">
                         <span className="text-lg font-bold text-primary-text">{Math.round(totalPercent)}%</span>
                     </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {categories.map((cat, index) => {
                    const percent = cat.budgetLimit > 0 ? (cat.spent / cat.budgetLimit) * 100 : 0;
                    const isOver = percent > 100;
                    const color = cat.color || getCategoryColor(cat.category, index);

                    return (
                        <Card key={cat.id || cat.category} className="p-6 bg-card-bg border border-border hover:border-primary-green/30 transition-colors">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                    <div 
                                        className="w-3 h-3 rounded-full" 
                                        style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}40` }} 
                                    />
                                    <span className="font-semibold text-primary-text">{cat.category}</span>
                                </div>
                                <span className={cn("text-sm font-mono", isOver ? "text-error" : "text-secondary-text")}>
                                    {Math.round(percent)}%
                                </span>
                            </div>

                            <div className="h-3 w-full bg-primary-bg rounded-full overflow-hidden mb-3">
                                <div 
                                    className={cn("h-full rounded-full transition-all duration-500")}
                                    style={{ 
                                        width: `${Math.min(percent, 100)}%`, 
                                        backgroundColor: isOver ? '#ef4444' : color 
                                    }}
                                />
                            </div>

                            <div className="flex justify-between text-xs text-secondary-text">
                                <span>{formatCurrency(cat.spent)} spent</span>
                                <span>{formatCurrency(cat.budgetLimit)} limit</span>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
