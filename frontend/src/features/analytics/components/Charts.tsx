"use client";

import React from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/shared/utils";

// Chart color palette for dark theme
const CHART_COLORS = {
  primary: "#6ECB8E",
  secondary: "#3498DB",
  accent: "#F39C12",
  purple: "#9B59B6",
  success: "#2ECC71",
  warning: "#E67E22",
  error: "#E74C3C",
  info: "#5DADE2",
  muted: "#6B7280",
};

const PIE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.accent,
  CHART_COLORS.purple,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.error,
  CHART_COLORS.info,
];

interface SpendingTrendData {
  month: string;
  spending: number;
  income?: number;
  date?: string;
}

interface CategoryBreakdownData {
  category: string;
  amount: number;
  percentage: number;
  color?: string;
}

interface MonthlyComparisonData {
  month: string;
  thisYear: number;
  lastYear: number;
}

// Custom Tooltip for dark theme
interface TooltipPayload {
  color: string;
  name: string;
  value: number | string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card-bg border border-muted-text/20 rounded-lg p-3 shadow-lg">
        <p className="text-primary-text font-medium">{label}</p>
        {payload.map((entry, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}:{" "}
            {typeof entry.value === "number"
              ? formatCurrency(entry.value)
              : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Spending Trend Chart Component
interface SpendingTrendChartProps {
  data: SpendingTrendData[];
  height?: number;
  showIncome?: boolean;
}

export function SpendingTrendChart({
  data,
  height = 300,
  showIncome = false,
}: SpendingTrendChartProps) {
  return (
    <div className="bg-card-bg rounded-lg p-6">
      <h3 className="text-lg font-semibold text-primary-text mb-4">
        Spending Trend
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.muted}
            opacity={0.3}
          />
          <XAxis dataKey="month" stroke={CHART_COLORS.muted} fontSize={12} />
          <YAxis
            stroke={CHART_COLORS.muted}
            fontSize={12}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="spending"
            stroke={CHART_COLORS.primary}
            strokeWidth={3}
            dot={{ r: 4, fill: CHART_COLORS.primary }}
            activeDot={{ r: 6, fill: CHART_COLORS.primary }}
            name="Spending"
          />
          {showIncome && (
            <Line
              type="monotone"
              dataKey="income"
              stroke={CHART_COLORS.success}
              strokeWidth={3}
              dot={{ r: 4, fill: CHART_COLORS.success }}
              activeDot={{ r: 6, fill: CHART_COLORS.success }}
              name="Income"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Category Breakdown Pie Chart
interface CategoryBreakdownChartProps {
  data: CategoryBreakdownData[];
  height?: number;
}

interface PieLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}

export function CategoryBreakdownChart({
  data,
  height = 300,
}: CategoryBreakdownChartProps) {
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: PieLabelProps) => {
    if (percent < 0.05) return null; // Don't show labels for slices < 5%

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="#E0E0E0"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={12}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="bg-card-bg rounded-lg p-6">
      <h3 className="text-lg font-semibold text-primary-text mb-4">
        Category Breakdown
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={80}
            fill="#8884d8"
            dataKey="amount"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={PIE_COLORS[index % PIE_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 space-y-2">
        {data.map((item, index) => (
          <div
            key={item.category}
            className="flex items-center justify-between"
          >
            <div className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                }}
              />
              <span className="text-sm text-secondary-text">
                {item.category}
              </span>
            </div>
            <span className="text-sm font-medium text-primary-text">
              {formatCurrency(item.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Monthly Comparison Bar Chart
interface MonthlyComparisonChartProps {
  data: MonthlyComparisonData[];
  height?: number;
}

export function MonthlyComparisonChart({
  data,
  height = 300,
}: MonthlyComparisonChartProps) {
  return (
    <div className="bg-card-bg rounded-lg p-6">
      <h3 className="text-lg font-semibold text-primary-text mb-4">
        Monthly Comparison
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.muted}
            opacity={0.3}
          />
          <XAxis dataKey="month" stroke={CHART_COLORS.muted} fontSize={12} />
          <YAxis
            stroke={CHART_COLORS.muted}
            fontSize={12}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar
            dataKey="thisYear"
            fill={CHART_COLORS.primary}
            name="This Year"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="lastYear"
            fill={CHART_COLORS.secondary}
            name="Last Year"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Area Chart for Spending Over Time
interface SpendingAreaChartProps {
  data: SpendingTrendData[];
  height?: number;
}

export function SpendingAreaChart({
  data,
  height = 300,
}: SpendingAreaChartProps) {
  return (
    <div className="bg-card-bg rounded-lg p-6">
      <h3 className="text-lg font-semibold text-primary-text mb-4">
        Spending Over Time
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <defs>
            <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={CHART_COLORS.primary}
                stopOpacity={0.8}
              />
              <stop
                offset="95%"
                stopColor={CHART_COLORS.primary}
                stopOpacity={0.1}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.muted}
            opacity={0.3}
          />
          <XAxis dataKey="month" stroke={CHART_COLORS.muted} fontSize={12} />
          <YAxis
            stroke={CHART_COLORS.muted}
            fontSize={12}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="spending"
            stroke={CHART_COLORS.primary}
            fillOpacity={1}
            fill="url(#colorSpending)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Weekly Spending Pattern Chart
interface WeeklySpendingData {
  day: string;
  amount: number;
}

interface WeeklySpendingChartProps {
  data: WeeklySpendingData[];
  height?: number;
}

export function WeeklySpendingChart({
  data,
  height = 300,
}: WeeklySpendingChartProps) {
  return (
    <div className="bg-card-bg rounded-lg p-6">
      <h3 className="text-lg font-semibold text-primary-text mb-4">
        Weekly Spending Pattern
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.muted}
            opacity={0.3}
          />
          <XAxis dataKey="day" stroke={CHART_COLORS.muted} fontSize={12} />
          <YAxis
            stroke={CHART_COLORS.muted}
            fontSize={12}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="amount"
            fill={CHART_COLORS.accent}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
