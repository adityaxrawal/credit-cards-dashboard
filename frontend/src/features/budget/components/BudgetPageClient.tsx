"use client";

import React, { useMemo } from "react";
import { formatCurrency, cn } from "@/shared/utils";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { Card } from "@/shared/components/ui";

// Mock Budget Data
const BUDGET_CATEGORIES = [
    { name: "Housing", spent: 2500, limit: 2600, color: "#8b5cf6" }, // Violet
    { name: "Food & Dining", spent: 850, limit: 800, color: "#f43f5e" }, // Rose (Over)
    { name: "Transportation", spent: 320, limit: 500, color: "#06b6d4" }, // Cyan
    { name: "Shopping", spent: 450, limit: 600, color: "#f59e0b" }, // Amber
    { name: "Utilities", spent: 180, limit: 250, color: "#10b981" }, // Emerald
];

export default function BudgetPageClient() {
    const totalSpent = BUDGET_CATEGORIES.reduce((a, b) => a + b.spent, 0);
    const totalLimit = BUDGET_CATEGORIES.reduce((a, b) => a + b.limit, 0);
    const totalPercent = (totalSpent / totalLimit) * 100;

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
                            data={[{ value: totalSpent }, { value: totalLimit - totalSpent }]}
                            cx={60}
                            cy={60}
                            innerRadius={40}
                            outerRadius={50}
                            startAngle={90}
                            endAngle={-270}
                            dataKey="value"
                            stroke="none"
                        >
                            <Cell fill="#10b981" />
                            <Cell fill="#334155" />
                        </Pie>
                     </PieChart>
                     <div className="absolute inset-0 flex items-center justify-center -ml-2 -mt-2">
                         <span className="text-lg font-bold text-primary-text">{Math.round(totalPercent)}%</span>
                     </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {BUDGET_CATEGORIES.map((cat) => {
                    const percent = (cat.spent / cat.limit) * 100;
                    const isOver = percent > 100;

                    return (
                        <Card key={cat.name} className="p-6 bg-card-bg border border-border hover:border-primary-green/30 transition-colors">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full shadow-[0_0_10px]" style={{ backgroundColor: cat.color, boxShadow: `0 0 10px ${cat.color}40` }} />
                                    <span className="font-semibold text-primary-text">{cat.name}</span>
                                </div>
                                <span className={cn("text-sm font-mono", isOver ? "text-error" : "text-secondary-text")}>
                                    {Math.round(percent)}%
                                </span>
                            </div>

                            <div className="h-3 w-full bg-primary-bg rounded-full overflow-hidden mb-3">
                                <div 
                                    className={cn("h-full rounded-full transition-all duration-500", isOver ? "bg-error" : "bg-primary-green")}
                                    style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: isOver ? '#ef4444' : cat.color }}
                                />
                            </div>

                            <div className="flex justify-between text-xs text-secondary-text">
                                <span>{formatCurrency(cat.spent)} spent</span>
                                <span>{formatCurrency(cat.limit)} limit</span>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
