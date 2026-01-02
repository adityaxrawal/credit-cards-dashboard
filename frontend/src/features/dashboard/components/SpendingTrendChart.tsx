"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/shared/utils";
import { SpendingTrendItem } from "@/features/analytics/api";

interface SpendingTrendChartProps {
  data: SpendingTrendItem[];
  className?: string;
}

export function SpendingTrendChart({ data, className }: SpendingTrendChartProps) {
  return (
    <div className={className}>
      <h3 className="text-lg font-semibold text-primary-text mb-4">Spending Trend</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{
              top: 10,
              right: 10,
              left: 0,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="colorDebit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="period" 
              tick={{ fontSize: 12, fill: '#9ca3af' }} 
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#9ca3af' }} 
              tickFormatter={(value) => `₹${value / 1000}k`}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '8px',
                color: '#f3f4f6'
              }}
              formatter={(value: number) => [formatCurrency(value), "Spent"]}
            />
            <Area
              type="monotone"
              dataKey="debit"
              stroke="#ef4444"
              fillOpacity={1}
              fill="url(#colorDebit)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
