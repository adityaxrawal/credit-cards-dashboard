"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/shared/utils";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82CA9D",
  "#FFC658",
  "#FF6B9D",
];

interface CategoryPieChartProps {
  data: Array<{
    name: string;
    value: number;
  }>;
  isLoading?: boolean;
}

export function CategoryPieChart({ data, isLoading }: CategoryPieChartProps) {
  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center bg-card-bg/50 rounded-lg animate-pulse">
        <p className="text-secondary-text">Loading categories...</p>
      </div>
    );
  }
  
  if (!data || data.length === 0) {
     return (
        <div className="h-[300px] flex items-center justify-center bg-card-bg/50 rounded-lg">
          <p className="text-secondary-text">No category data available</p>
        </div>
      );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
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
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
              stroke="rgba(0,0,0,0)"
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#1F2937',
            border: 'none',
            borderRadius: '8px',
            color: '#F3F4F6',
             boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
          formatter={(value: number) => formatCurrency(value)}
        />
        <Legend wrapperStyle={{ paddingTop: "20px" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
