"use client";

import React from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card } from "@/shared/components/ui";
import { formatCurrency } from "@/shared/utils";

interface FinancialHealthData {
  month: string;
  assets: number;
  liabilities: number;
  netWorth: number;
}

interface FinancialHealthChartProps {
  data: FinancialHealthData[];
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card-bg/95 backdrop-blur border border-border p-3 rounded-lg shadow-xl text-xs">
        <p className="font-semibold text-primary-text mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-secondary-text capitalize">
                {entry.name}:
              </span>
              <span className="font-mono font-medium text-primary-text">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function FinancialHealthChart({
  data,
  isLoading,
}: FinancialHealthChartProps) {
  if (isLoading) {
    return (
      <Card className="h-[400px] flex items-center justify-center animate-pulse">
        <div className="w-full h-full bg-muted-text/5 rounded-lg" />
      </Card>
    );
  }

  return (
    <Card className="p-6 h-[400px] flex flex-col bg-card-bg border-border">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-primary-text">
            Financial Health
          </h3>
          <p className="text-sm text-secondary-text">
            Assets vs Liabilities & Net Worth Trend
          </p>
        </div>
        {/* Legend / Actions could go here */}
      </div>

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6ECB8E" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#6ECB8E" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorLiabilities" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D93025" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#D93025" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="rgba(255,255,255,0.05)"
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94A3B8", fontSize: 12 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94A3B8", fontSize: 12 }}
              tickFormatter={(value) =>
                new Intl.NumberFormat("en-US", {
                  notation: "compact",
                  compactDisplay: "short",
                }).format(value)
              }
            />
            <Tooltip cursor={false} content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: "20px" }}
              formatter={(value) => (
                <span className="text-sm text-secondary-text capitalize">
                  {value}
                </span>
              )}
            />
            <Bar
              dataKey="assets"
              name="Assets"
              fill="url(#colorAssets)"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
            <Bar
              dataKey="liabilities"
              name="Liabilities"
              fill="url(#colorLiabilities)"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
            <Line
              type="monotone"
              dataKey="netWorth"
              name="Net Worth"
              stroke="#FFB020"
              strokeWidth={3}
              dot={{ r: 4, fill: "#FFB020", strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
