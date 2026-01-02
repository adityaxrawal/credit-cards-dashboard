"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/shared/components/ui";
import { formatCurrency } from "@/shared/utils";

const data = [
  { name: "Housing", value: 2000, color: "#6ECB8E" },
  { name: "Food", value: 800, color: "#FFB020" },
  { name: "Transport", value: 400, color: "#3B82F6" },
  { name: "Utilities", value: 300, color: "#A855F7" },
  { name: "Entertainment", value: 200, color: "#EC4899" },
];

export default function IntelligencePage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-card-bg border-border h-[400px]">
          <h3 className="text-lg font-semibold mb-4 text-primary-text">Top Spending Categories</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 bg-card-bg border-border h-[400px]">
           <h3 className="text-lg font-semibold mb-4 text-primary-text">Anomalies Detected</h3>
           <div className="space-y-4">
                <div className="p-4 bg-hover-bg rounded-lg border border-border">
                    <div className="flex justify-between items-start">
                        <div>
                            <h4 className="font-medium text-warning">High Grocery Spend</h4>
                            <p className="text-sm text-secondary-text mt-1">30% higher than average this month.</p>
                        </div>
                        <span className="text-xs font-mono text-primary-text bg-background px-2 py-1 rounded">
                            +$150
                        </span>
                    </div>
                </div>
                 <div className="p-4 bg-hover-bg rounded-lg border border-border">
                    <div className="flex justify-between items-start">
                        <div>
                            <h4 className="font-medium text-success">Low Utilities</h4>
                            <p className="text-sm text-secondary-text mt-1">15% lower than average this month.</p>
                        </div>
                        <span className="text-xs font-mono text-primary-text bg-background px-2 py-1 rounded">
                            -$45
                        </span>
                    </div>
                </div>
           </div>
        </Card>
      </div>
    </div>
  );
}
