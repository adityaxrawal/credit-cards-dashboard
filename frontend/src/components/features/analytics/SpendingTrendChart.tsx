"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface SpendingTrendChartProps {
  data: Array<{
    label: string;
    value: number;
  }>;
  isLoading?: boolean;
}

export function SpendingTrendChart({ data, isLoading }: SpendingTrendChartProps) {
  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center bg-card-bg/50 rounded-lg animate-pulse">
        <p className="text-secondary-text">Loading trends...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
     return (
        <div className="h-[300px] flex items-center justify-center bg-card-bg/50 rounded-lg">
          <p className="text-secondary-text">No trend data available</p>
        </div>
      );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
        <XAxis 
            dataKey="label" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            tickMargin={10} 
        />
        <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            tickFormatter={(value) => `$${value}`} 
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1F2937',
            border: 'none',
            borderRadius: '8px',
            color: '#F3F4F6',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
          formatter={(value: number) => [formatCurrency(value), 'Spent']}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#10B981"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorValue)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
